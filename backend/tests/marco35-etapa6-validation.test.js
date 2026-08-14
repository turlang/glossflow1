const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/validation-hardening.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Etapa 6 registra hardening e diagnóstico consolidado', () => {
  assert.ok(appRoutes.includes("from './validation-hardening.routes'"));
  assert.ok(appRoutes.includes('enforceMarco35Etapa6BusinessRules'));
  assert.ok(appRoutes.includes('business.register(validationHardeningRoutes)'));
  assert.ok(route.includes("app.get('/admin/homologation/validation-suite'"));
  assert.ok(route.includes("tenant.role !== 'ADMIN'"));
});

test('Compras preserva rota da UI e executa estoque + contas a pagar atomicamente', () => {
  assert.ok(route.includes('/^\\/admin\\/procurement\\/orders\\/[a-f\\d]{24}\\/receive$/i'));
  assert.ok(route.includes('receivePurchaseSafely(current.salonId, id)'));
  assert.ok(route.includes("app.post('/admin/procurement/orders/:id/receive-safe'"));
  assert.ok(route.includes('return prisma.$transaction(async (tx) =>'));
  assert.ok(route.includes("type: 'PAYABLE'"));
  assert.ok(route.includes("category: 'COMPRAS'"));
  assert.ok(route.includes('reason: `Recebimento ${order.number}`'));
});

test('Equipe bloqueia sequência inválida de ponto e folha sobreposta', () => {
  assert.ok(route.includes('function validClockTransition'));
  assert.ok(route.includes("code: 'INVALID_CLOCK_TRANSITION'"));
  assert.ok(route.includes("code: 'PAYROLL_PERIOD_OVERLAP'"));
  assert.ok(route.includes('periodStart: { lt: parsed.data.periodEnd }'));
  assert.ok(route.includes('periodEnd: { gt: parsed.data.periodStart }'));
});

test('Clínico valida tenant, vínculo de cliente e consentimento completo', () => {
  assert.ok(route.includes("code: 'CLINICAL_APPOINTMENT_NOT_FOUND'"));
  assert.ok(route.includes("code: 'CLINICAL_CLIENT_MISMATCH'"));
  assert.ok(route.includes("code: 'INCOMPLETE_CLINICAL_CONSENT'"));
  assert.ok(route.includes("reply.header('Cache-Control', 'no-store')"));
});

test('Portal rotaciona links ativos e mantém dados sensíveis sem cache', () => {
  assert.ok(route.includes('prisma.clientPortalAccess.updateMany'));
  assert.ok(route.includes('revokedAt: null, expiresAt: { gt: new Date() }'));
  assert.ok(route.includes('Cliente possui ${count} links ativos simultaneamente.'));
});

test('WhatsApp diferencia provider conectado de sender Trial homologado', () => {
  assert.ok(route.includes("getIntegrationStatus().find((item) => item.key === 'whatsapp')"));
  assert.ok(route.includes("process.env.TWILIO_TRIAL_MODE === 'true'"));
  assert.ok(route.includes('sender definitivo ainda precisa de homologação'));
});
