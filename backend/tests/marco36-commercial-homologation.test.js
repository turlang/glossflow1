const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/commercial-homologation.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

const modules = ['WHATSAPP', 'POS', 'PACOTES', 'COMPRAS', 'EQUIPE', 'CLINICO', 'PORTAL_CLIENTE', 'RECURSOS'];

test('Marco 36 etapa 2 exige ADMIN e tenant autenticado', () => {
  assert.ok(route.includes("tenant.role !== 'ADMIN'"));
  assert.ok(route.includes('current.salonId'));
  assert.ok(route.includes("app.get('/admin/homologation/commercial'"));
});

test('manifesto cobre exatamente os oito módulos VALIDATION_REQUIRED', () => {
  for (const moduleKey of modules) {
    assert.ok(route.includes(`module: '${moduleKey}'`), `módulo ausente: ${moduleKey}`);
  }
  assert.ok(route.includes('total: modules.length'));
});

test('manifesto referencia os probes canônicos já existentes', () => {
  assert.ok(route.includes("'/admin/homologation/transactional'"));
  assert.ok(route.includes("'/admin/homologation/operations'"));
  assert.ok(route.includes("'/admin/homologation/checkout-flow'"));
  assert.ok(route.includes("'/admin/homologation/validation-suite'"));
});

test('homologação comercial é explicitamente read-only e não promove maturidade automaticamente', () => {
  assert.ok(route.includes('readOnly: true'));
  assert.ok(route.includes('requiresQaEvidence: true'));
  assert.ok(route.includes('automaticPromotion: false'));
  assert.ok(route.includes('productionDataMutationAllowed: false'));
});

test('WhatsApp Trial não pode virar evidência de sender definitivo', () => {
  assert.ok(route.includes("process.env.TWILIO_TRIAL_MODE === 'true'"));
  assert.ok(route.includes('definitiveSenderValidated'));
  assert.ok(route.includes('Twilio Trial/sandbox não pode ser promovido como sender comercial definitivo.'));
});

test('limites comerciais sensíveis permanecem declarados', () => {
  assert.ok(route.includes('Recebimento parcial não é representado pelo modelo atual'));
  assert.ok(route.includes('Folha legal/fiscal brasileira permanece fora do escopo'));
  assert.ok(route.includes('homologação humana dedicada de segurança, UX e LGPD'));
  assert.ok(route.includes('sem exposição cross-tenant'));
});

test('rota comercial é registrada no grupo business', () => {
  assert.ok(appRoutes.includes("import { commercialHomologationRoutes } from './commercial-homologation.routes';"));
  assert.ok(appRoutes.includes('business.register(commercialHomologationRoutes)'));
});
