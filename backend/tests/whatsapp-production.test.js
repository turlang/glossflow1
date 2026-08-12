require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const whatsappService = require('../src/services/whatsapp.service.ts');
const conversation = require('../src/services/whatsapp-agent/conversation.repository.ts');

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

const salonId = '507f1f77bcf86cd799439011';
const phone = '5511999999999';
const now = new Date('2026-08-12T15:00:00.000Z');

test('janela aberta usa mensagem livre e persiste saída somente após sucesso do provider', async () => {
  let freeCalls = 0;
  let templateCalls = 0;
  let saved = 0;
  const audits = [];
  await withPatches([
    [prisma.auditLog, {
      findMany: async () => [{ createdAt: new Date(now.getTime() - 60 * 60 * 1000), metadata: { phone } }],
      create: async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}`, ...data }; }
    }],
    [whatsappService, {
      sendWhatsAppMessage: async () => { freeCalls += 1; return { ok: true, provider: 'meta', messageId: 'wamid-1' }; },
      sendWhatsAppTemplateMessage: async () => { templateCalls += 1; return { ok: true, provider: 'meta' }; }
    }],
    [conversation, { saveWhatsAppMessage: async () => { saved += 1; return { id: 'msg-1' }; } }]
  ], async () => {
    const { sendPolicyCompliantWhatsApp } = reload('../src/services/whatsapp-agent/outbound-policy.service.ts');
    const result = await sendPolicyCompliantWhatsApp({ salonId, phone, message: 'Olá!', event: 'RETENTION_FOLLOWUP', now });
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'FREE_FORM');
    assert.equal(freeCalls, 1);
    assert.equal(templateCalls, 0);
    assert.equal(saved, 1);
    assert.ok(audits.some((item) => item.action === 'WHATSAPP_POLICY_SENT'));
  });
});

test('janela fechada bloqueia mensagem proativa sem template configurado', async () => {
  let providerCalls = 0;
  await withEnv({ WHATSAPP_TEMPLATE_RETENTION_FOLLOWUP: undefined }, async () => {
    await withPatches([
      [prisma.auditLog, { findMany: async () => [] }],
      [whatsappService, {
        sendWhatsAppMessage: async () => { providerCalls += 1; return { ok: true }; },
        sendWhatsAppTemplateMessage: async () => { providerCalls += 1; return { ok: true }; }
      }]
    ], async () => {
      const { sendPolicyCompliantWhatsApp } = reload('../src/services/whatsapp-agent/outbound-policy.service.ts');
      const result = await sendPolicyCompliantWhatsApp({ salonId, phone, message: 'Sentimos sua falta.', event: 'RETENTION_FOLLOWUP', now });
      assert.equal(result.ok, false);
      assert.equal(result.code, 'PROVIDER_TEMPLATE_REQUIRED');
      assert.equal(result.mode, 'TEMPLATE');
      assert.equal(providerCalls, 0);
    });
  });
});

test('janela fechada usa template do provider quando configurado', async () => {
  let templateName = '';
  let saved = 0;
  await withEnv({ WHATSAPP_TEMPLATE_RETENTION_FOLLOWUP: 'HXRETENTION123' }, async () => {
    await withPatches([
      [prisma.auditLog, {
        findMany: async () => [],
        create: async ({ data }) => ({ id: 'audit-policy', ...data })
      }],
      [whatsappService, {
        sendWhatsAppMessage: async () => { throw new Error('texto livre não deveria ser usado'); },
        sendWhatsAppTemplateMessage: async (input) => { templateName = input.templateName; return { ok: true, provider: 'twilio', messageId: 'SM123' }; }
      }],
      [conversation, { saveWhatsAppMessage: async () => { saved += 1; return { id: 'msg-template' }; } }]
    ], async () => {
      const { sendPolicyCompliantWhatsApp } = reload('../src/services/whatsapp-agent/outbound-policy.service.ts');
      const result = await sendPolicyCompliantWhatsApp({ salonId, phone, message: 'Sentimos sua falta.', event: 'RETENTION_FOLLOWUP', now });
      assert.equal(result.ok, true);
      assert.equal(result.mode, 'TEMPLATE');
      assert.equal(templateName, 'HXRETENTION123');
      assert.equal(saved, 1);
    });
  });
});

test('falha do provider gera evento de falha e nunca persiste WHATSAPP_SENT', async () => {
  const audits = [];
  let saved = 0;
  await withPatches([
    [prisma.auditLog, {
      findMany: async () => [{ createdAt: new Date(now.getTime() - 30 * 60 * 1000), metadata: { phone } }],
      create: async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}`, ...data }; }
    }],
    [whatsappService, { sendWhatsAppMessage: async () => ({ ok: false, provider: 'meta', code: 'UPSTREAM_ERROR' }) }],
    [conversation, { saveWhatsAppMessage: async () => { saved += 1; return { id: 'should-not-save' }; } }]
  ], async () => {
    const { sendPolicyCompliantWhatsApp } = reload('../src/services/whatsapp-agent/outbound-policy.service.ts');
    const result = await sendPolicyCompliantWhatsApp({ salonId, phone, message: 'Olá!', event: 'RETENTION_FOLLOWUP', now });
    assert.equal(result.ok, false);
    assert.equal(saved, 0);
    assert.equal(audits.filter((item) => item.action === 'WHATSAPP_PROVIDER_FAILED').length, 1);
    assert.equal(audits.filter((item) => item.action === 'WHATSAPP_POLICY_SENT').length, 0);
  });
});

test('métricas calculam resolução automática, handoff, ações e falhas por tenant', async () => {
  const originalFindMany = prisma.auditLog.findMany;
  prisma.auditLog.findMany = async ({ where }) => {
    assert.equal(where.salonId, salonId);
    return [
      { action: 'WHATSAPP_RECEIVED', resource: 'WhatsAppMessage', resourceId: null, metadata: { phone: '5511111111111', direction: 'IN' }, createdAt: now },
      { action: 'WHATSAPP_SENT', resource: 'WhatsAppMessage', resourceId: 'm1', metadata: { phone: '5511111111111', direction: 'OUT' }, createdAt: now },
      { action: 'WHATSAPP_RECEIVED', resource: 'WhatsAppMessage', resourceId: null, metadata: { phone: '5522222222222', direction: 'IN' }, createdAt: now },
      { action: 'HANDOFF_OPEN', resource: 'WhatsAppHandoff', resourceId: '5522222222222', metadata: {}, createdAt: now },
      { action: 'WHATSAPP_ACTION_PENDING', resource: 'WhatsAppPendingAction', resourceId: '5511111111111', metadata: {}, createdAt: now },
      { action: 'WHATSAPP_ACTION_COMPLETED', resource: 'WhatsAppPendingAction', resourceId: '5511111111111', metadata: {}, createdAt: now },
      { action: 'WHATSAPP_PROVIDER_FAILED', resource: 'WhatsAppOutbound', resourceId: '5522222222222', metadata: {}, createdAt: now }
    ];
  };
  try {
    const { getWhatsAppOperationalMetrics } = reload('../src/services/whatsapp-agent/metrics.service.ts');
    const metrics = await getWhatsAppOperationalMetrics(salonId, 30);
    assert.equal(metrics.messagesIn, 2);
    assert.equal(metrics.messagesOut, 1);
    assert.equal(metrics.handoffsOpened, 1);
    assert.equal(metrics.actionsProposed, 1);
    assert.equal(metrics.actionsCompleted, 1);
    assert.equal(metrics.providerFailures, 1);
    assert.equal(metrics.automaticResolutionRate, 50);
  } finally {
    prisma.auditLog.findMany = originalFindMany;
  }
});
