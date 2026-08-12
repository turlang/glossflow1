require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const aiProvider = require('../src/services/ai-provider.service.ts');
const appointmentTools = require('../src/services/whatsapp-agent/appointment-tools.service.ts');
const conversation = require('../src/services/whatsapp-agent/conversation.repository.ts');

const salon = {
  id: '507f1f77bcf86cd799439011',
  name: 'GlossFlow Teste',
  description: 'Salão de testes',
  whatsapp: '5511999999999',
  openingHours: '09h às 19h'
};

function reload(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(modulePath);
}

async function withPatches(patches, run) {
  const originals = [];
  for (const [target, methods] of patches) {
    for (const [name, replacement] of Object.entries(methods)) {
      originals.push([target, name, target[name]]);
      target[name] = replacement;
    }
  }
  try {
    return await run();
  } finally {
    for (const [target, name, original] of originals.reverse()) target[name] = original;
  }
}

async function withEnv(values, run) {
  const previous = {};
  for (const [name, value] of Object.entries(values)) {
    previous[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('dispatcher executa ferramenta de consulta real sem provider externo', async () => {
  await withPatches([[appointmentTools, {
    listServices: async (salonId) => {
      assert.equal(salonId, salon.id);
      return [{ id: 's1', name: 'Corte', price: 120 }];
    }
  }]], async () => {
    const { runTool } = reload('../src/services/whatsapp-agent/tools.ts');
    const result = await runTool('listar_servicos', {}, salon, '5511988887777');
    assert.deepEqual(result, [{ id: 's1', name: 'Corte', price: 120 }]);
  });
});

test('dispatcher abre handoff humano com telefone e motivo normalizados', async () => {
  let handoff = null;
  await withPatches([[conversation, {
    openHumanHandoff: async (salonId, phone, reason) => {
      handoff = { salonId, phone, reason };
      return { id: 'handoff-1' };
    }
  }]], async () => {
    const { runTool } = reload('../src/services/whatsapp-agent/tools.ts');
    const result = await runTool('transferir_para_humano', { reason: 'Cliente pediu uma pessoa' }, salon, '(11) 98888-7777');
    assert.equal(result.ok, true);
    assert.deepEqual(handoff, {
      salonId: salon.id,
      phone: '(11) 98888-7777',
      reason: 'Cliente pediu uma pessoa'
    });
  });
});

test('orquestrador usa fallback quando IA não está configurada', async () => {
  await withEnv({ AI_PROVIDER: 'groq', GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined }, async () => {
    await withPatches([
      [conversation, { conversationHistory: async () => [] }],
      [appointmentTools, { listServices: async () => [{ id: 's1', name: 'Corte', price: 99.9 }] }]
    ], async () => {
      const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
      const reply = await answerWhatsAppMessage({ salon, phone: '5511988887777', text: 'qual o preço dos serviços?' });
      assert.match(reply, /Corte/);
      assert.match(reply, /99,90/);
    });
  });
});

test('orquestrador faz fallback seguro quando provider configurado falha', async () => {
  await withEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key', GROQ_API_KEY: undefined }, async () => {
    await withPatches([
      [conversation, { conversationHistory: async () => [] }],
      [appointmentTools, { listServices: async () => [{ id: 's1', name: 'Escova', price: 80 }] }],
      [aiProvider, { requestAIResponse: async () => { throw new Error('provider indisponível'); } }]
    ], async () => {
      const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
      const reply = await answerWhatsAppMessage({ salon, phone: '5511988887777', text: 'qual o valor do serviço?' });
      assert.match(reply, /Escova/);
      assert.match(reply, /80,00/);
    });
  });
});

test('pedido humano durante fallback abre handoff e retorna resposta de transferência', async () => {
  let opened = null;
  await withEnv({ AI_PROVIDER: 'groq', GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined }, async () => {
    await withPatches([
      [conversation, {
        conversationHistory: async () => [],
        openHumanHandoff: async (salonId, phone, reason) => {
          opened = { salonId, phone, reason };
          return { id: 'handoff-2' };
        }
      }],
      [appointmentTools, { listServices: async () => [] }]
    ], async () => {
      const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
      const reply = await answerWhatsAppMessage({ salon, phone: '5511988887777', text: 'quero falar com um atendente humano' });
      assert.match(reply, /encaminhar/i);
      assert.equal(opened.salonId, salon.id);
      assert.equal(opened.phone, '5511988887777');
      assert.match(opened.reason, /fallback/i);
    });
  });
});

test('repositório registra abertura e fechamento do handoff no mesmo tenant', async () => {
  const writes = [];
  const originalCreate = prisma.auditLog.create;
  prisma.auditLog.create = async ({ data }) => {
    writes.push(data);
    return { id: `audit-${writes.length}`, ...data };
  };
  try {
    await conversation.openHumanHandoff(salon.id, '(11) 98888-7777', 'Precisa falar com a equipe');
    await conversation.closeHumanHandoff(salon.id, '(11) 98888-7777');
  } finally {
    prisma.auditLog.create = originalCreate;
  }

  assert.equal(writes.length, 2);
  assert.equal(writes[0].action, 'HANDOFF_OPEN');
  assert.equal(writes[1].action, 'HANDOFF_CLOSED');
  assert.equal(writes[0].salonId, salon.id);
  assert.equal(writes[1].salonId, salon.id);
  assert.equal(writes[0].resourceId, '11988887777');
  assert.equal(writes[1].resourceId, '11988887777');
});
