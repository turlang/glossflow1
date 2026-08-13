const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/evolution-hardening.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Marco 35 etapa 4 usa ADMIN e salonId como escopo', () => {
  assert.ok(route.includes("tenant.role !== 'ADMIN'"));
  assert.ok(route.includes('current.salonId'));
});

test('Marketing exige consentimento MARKETING e prepara público sem disparo implícito', () => {
  assert.ok(route.includes("type: 'MARKETING'"));
  assert.ok(route.includes("app.get('/admin/marketing/campaigns/:id/preview'"));
  assert.ok(route.includes("app.post('/admin/marketing/campaigns/:id/prepare'"));
  assert.ok(route.includes("z.literal('PREPARAR CAMPANHA')"));
  assert.ok(route.includes("deliveryState: 'READY_FOR_PROVIDER'"));
});

test('Multiunidade permite saída e revogação explícitas', () => {
  assert.ok(route.includes("/admin/organizations/memberships/:id/leave"));
  assert.ok(route.includes("status: 'LEFT'"));
  assert.ok(route.includes("/locations/:locationId/revoke"));
  assert.ok(route.includes("status: 'REVOKED'"));
});

test('Financeiro sincroniza compras recebidas com contas a pagar de forma idempotente', () => {
  assert.ok(route.includes("/admin/finance-advanced/sync-purchase-payables"));
  assert.ok(route.includes("status: 'RECEIVED'"));
  assert.ok(route.includes("type: 'PAYABLE'"));
  assert.ok(route.includes('description: `Compra ${order.number}`'));
  assert.ok(route.includes('if (existing)'));
});

test('Fiscal só possui rota de emissão com evidência de provider', () => {
  assert.ok(route.includes("/admin/finance-advanced/fiscal-documents/:id/issue"));
  assert.ok(route.includes('externalId: z.string().trim().min(2)'));
  assert.ok(route.includes("status: 'ISSUED'"));
  assert.ok(route.includes('issuedAt: new Date()'));
});

test('Diagnóstico de evolução cobre marketing, multiunidade, compras e fiscal', () => {
  assert.ok(route.includes("/admin/homologation/evolution"));
  assert.ok(route.includes("domain: 'MARKETING'"));
  assert.ok(route.includes("domain: 'MULTIUNIT'"));
  assert.ok(route.includes("domain: 'FINANCE_PURCHASE'"));
  assert.ok(route.includes("domain: 'FISCAL'"));
});

test('rota de evolução é registrada no grupo business', () => {
  assert.ok(appRoutes.includes("import { evolutionHardeningRoutes } from './evolution-hardening.routes';"));
  assert.ok(appRoutes.includes('business.register(evolutionHardeningRoutes)'));
});
