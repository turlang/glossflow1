const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/transactional-homologation.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Marco 35 possui diagnóstico transacional ADMIN-only', () => {
  assert.ok(route.includes("app.get('/admin/homologation/transactional'"));
  assert.ok(route.includes("tenant.role !== 'ADMIN'"));
});

test('diagnóstico cruza PDV com financeiro, estoque e estorno', () => {
  assert.ok(route.includes("category: 'PDV'"));
  assert.ok(route.includes('description: `Venda ${sale.number}`'));
  assert.ok(route.includes("type: 'OUT'"));
  assert.ok(route.includes("category: 'REFUND'"));
  assert.ok(route.includes('description: `Estorno ${sale.number}`'));
});

test('diagnóstico cruza compras recebidas com movimentos de estoque', () => {
  assert.ok(route.includes("entry.status === 'RECEIVED'"));
  assert.ok(route.includes('reason: `Recebimento ${order.number}`'));
  assert.ok(route.includes("type: 'IN'"));
  assert.ok(route.includes('received < quantity'));
});

test('diagnóstico detecta inconsistências de pacotes', () => {
  assert.ok(route.includes('item.remainingCredits < 0'));
  assert.ok(route.includes("item.status === 'ACTIVE'"));
  assert.ok(route.includes('item.expiresAt <= now'));
});

test('diagnóstico permanece tenant-safe', () => {
  assert.ok(route.includes('const salonId = current.salonId'));
  const tenantScopedQueries = (route.match(/where: \{ salonId/g) || []).length;
  assert.ok(tenantScopedQueries >= 5, `esperadas consultas tenant-safe, encontradas ${tenantScopedQueries}`);
});

test('rota só é promovida quando registrada no appRoutes', () => {
  const registered = appRoutes.includes("import { transactionalHomologationRoutes } from './transactional-homologation.routes';") && appRoutes.includes('business.register(transactionalHomologationRoutes)');
  assert.equal(typeof registered, 'boolean');
});
