require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const aiProvider = require('../src/services/ai-provider.service.ts');
const appointmentTools = require('../src/services/whatsapp-agent/appointment-tools.service.ts');
const actionConfirmation = require('../src/services/whatsapp-agent/action-confirmation.service.ts');
const conversation = require('../src/services/whatsapp-agent/conversation.repository.ts');
const { buildSalonKnowledgeBase } = require('../src/services/whatsapp-agent/knowledge-base.service.ts');

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

test('mutação solicitada pela IA vira proposta e nunca executa no mesmo tool call', async () => {
  let created = false;
  let pending = null;
  await withPatches([
    [appointmentTools, {
      previewCreateAppointment: async () => ({ ok: true, message: 'Agendar Corte com Ana em 20/08/2026 às 10:00.' }),
      createAppointment: async () => { created = true; return { ok: true }; }
    }],
    [actionConfirmation, {
      createPendingAction: async (input) => {
        pending = input;
        return { id: 'pending-1', ...input, expiresAt: new Date(Date.now() + 600000) };
      }
    }]
  ], async () => {
    const { runTool } = reload('../src/services/whatsapp-agent/tools.ts');
    const result = await runTool('criar_agendamento', {
      service_id: 's1', professional_id: 'p1', start_time: '2026-08-20T13:00:00.000Z', client_name: 'Carla', confirmed: true
    }, salon, '5511988887777');
    assert.equal(result.requiresConfirmation, true);
    assert.equal(created, false);
    assert.equal(pending.type, 'CREATE_APPOINTMENT');
    assert.match(result.message, /CONFIRMAR/);
  });
});

test('parser de confirmação aceita apenas respostas curtas e inequívocas', () => {
  assert.equal(actionConfirmation.confirmationDecision('confirmo'), 'CONFIRM');
  assert.equal(actionConfirmation.confirmationDecision('Sim, pode agendar!'), 'CONFIRM');
  assert.equal(actionConfirmation.confirmationDecision('não quero'), 'CANCEL');
  assert.equal(actionConfirmation.confirmationDecision('pode me dizer se há outro horário?'), 'UNKNOWN');
});

test('confirmação explícita em mensagem posterior executa a proposta exatamente uma vez', async () => {
  const states = [];
  let executions = 0;
  const pending = {
    id: 'pending-1', salonId: salon.id, phone: '5511988887777', type: 'CREATE_APPOINTMENT',
    payload: { service_id: 's1', professional_id: 'p1', start_time: '2026-08-20T13:00:00.000Z', client_name: 'Carla' },
    summary: 'Agendar Corte com Ana em 20/08/2026 às 10:00.', expiresAt: new Date(Date.now() + 600000)
  };
  await withPatches([
    [actionConfirmation, {
      pendingActionForPhone: async () => pending,
      recordPendingActionState: async (state) => { states.push(state); return { id: 'audit-state' }; }
    }],
    [appointmentTools, {
      createAppointment: async () => {
        executions += 1;
        return { ok: true, message: 'Agendamento confirmado com segurança.' };
      }
    }]
  ], async () => {
    const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
    const reply = await answerWhatsAppMessage({ salon, phone: pending.phone, text: 'CONFIRMAR' });
    assert.equal(executions, 1);
    assert.match(reply, /confirmado com segurança/i);
    assert.equal(states[0].state, 'COMPLETED');
  });
});

test('mensagem ambígua mantém ação pendente sem executar Agenda ou chamar IA', async () => {
  let providerCalls = 0;
  const pending = {
    id: 'pending-2', salonId: salon.id, phone: '5511988887777', type: 'CANCEL_APPOINTMENT',
    payload: { appointment_id: 'a1' }, summary: 'Cancelar Corte de amanhã às 10:00.', expiresAt: new Date(Date.now() + 600000)
  };
  await withPatches([
    [actionConfirmation, { pendingActionForPhone: async () => pending }],
    [aiProvider, { requestAIResponse: async () => { providerCalls += 1; return { output: [] }; } }]
  ], async () => {
    const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
    const reply = await answerWhatsAppMessage({ salon, phone: pending.phone, text: 'e se eu mudar para sexta?' });
    assert.equal(providerCalls, 0);
    assert.match(reply, /CONFIRMAR/);
  });
});

test('cliente pode cancelar uma proposta sem alterar a Agenda', async () => {
  const states = [];
  const pending = {
    id: 'pending-3', salonId: salon.id, phone: '5511988887777', type: 'RESCHEDULE_APPOINTMENT',
    payload: { appointment_id: 'a1', start_time: '2026-08-21T13:00:00.000Z' }, summary: 'Reagendar Corte.', expiresAt: new Date(Date.now() + 600000)
  };
  await withPatches([[actionConfirmation, {
    pendingActionForPhone: async () => pending,
    recordPendingActionState: async (state) => { states.push(state); return { id: 'audit-state' }; }
  }]], async () => {
    const { answerWhatsAppMessage } = reload('../src/services/whatsapp-agent/orchestrator.service.ts');
    const reply = await answerWhatsAppMessage({ salon, phone: pending.phone, text: 'CANCELAR AÇÃO' });
    assert.match(reply, /nenhuma alteração/i);
    assert.equal(states[0].state, 'CANCELED');
  });
});

test('orquestrador usa fallback quando IA não está configurada', async () => {
  await withEnv({ AI_PROVIDER: 'groq', GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined }, async () => {
    await withPatches([
      [actionConfirmation, { pendingActionForPhone: async () => null }],
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
      [actionConfirmation, { pendingActionForPhone: async () => null }],
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
      [actionConfirmation, { pendingActionForPhone: async () => null }],
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

test('base factual usa somente dados cadastrados do tenant', () => {
  const knowledge = buildSalonKnowledgeBase({ ...salon, address: '', phone: '' }, [{ id: 's1', name: 'Corte', description: 'Corte clássico', price: 120, durationMin: 45 }]);
  assert.match(knowledge, /Corte: R\$ 120,00/);
  assert.match(knowledge, /45 min/);
  assert.match(knowledge, /Endereço: não cadastrado/);
  assert.match(knowledge, /não complete lacunas por suposição/i);
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
    assert.deepEqual(handoff, { salonId: salon.id, phone: '(11) 98888-7777', reason: 'Cliente pediu uma pessoa' });
  });
});

test('handoff persiste contexto recente e abertura/fechamento no mesmo tenant', async () => {
  const writes = [];
  const originalCreate = prisma.auditLog.create;
  const originalFindMany = prisma.auditLog.findMany;
  prisma.auditLog.findMany = async () => [
    { metadata: { phone: '11988887777', direction: 'OUT', text: 'Como posso ajudar?' } },
    { metadata: { phone: '11988887777', direction: 'IN', text: 'Quero falar com uma pessoa.' } }
  ];
  prisma.auditLog.create = async ({ data }) => {
    writes.push(data);
    return { id: `audit-${writes.length}`, ...data };
  };
  try {
    await conversation.openHumanHandoff(salon.id, '(11) 98888-7777', 'Precisa falar com a equipe');
    await conversation.closeHumanHandoff(salon.id, '(11) 98888-7777');
  } finally {
    prisma.auditLog.create = originalCreate;
    prisma.auditLog.findMany = originalFindMany;
  }

  assert.equal(writes.length, 2);
  assert.equal(writes[0].action, 'HANDOFF_OPEN');
  assert.equal(writes[1].action, 'HANDOFF_CLOSED');
  assert.equal(writes[0].salonId, salon.id);
  assert.equal(writes[0].resourceId, '11988887777');
  assert.equal(writes[0].metadata.context.length, 2);
  assert.ok(writes[0].metadata.context.some((item) => /pessoa/i.test(item.text)));
});
