const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const suite = read('src/routes/operations-suite.routes.ts');
const network = read('src/routes/organization-network.routes.ts');
const checkout = read('src/routes/appointment-checkout.routes.ts');
const transactional = read('src/routes/transactional-homologation.routes.ts');
const operational = read('src/routes/operational-homologation.routes.ts');
const evolution = read('src/routes/evolution-hardening.routes.ts');
const validation = read('src/routes/validation-hardening.routes.ts');
const appRoutes = read('src/routes/appRoutes.ts');

test('Marco 35 mantém operações comerciais sob autenticação, tenant e entitlement', () => {
  assert.ok(appRoutes.includes("business.addHook('preHandler', ensureAuthenticated)"));
  assert.ok(appRoutes.includes("business.addHook('preHandler', enforceTenantRateLimit)"));
  assert.ok(appRoutes.includes("business.addHook('preHandler', enforceTenantSubscriptionAccess)"));
  assert.ok(appRoutes.includes("business.addHook('preHandler', enforceSalonModuleAccess)"));
  assert.ok(appRoutes.includes("business.addHook('onResponse', writeAuditLog)"));
});

test('suite de expansão usa salonId da sessão como fronteira operacional', () => {
  assert.ok(suite.includes('function tenantId(request: FastifyRequest)'));
  assert.ok(suite.includes('return getTenant(request).salonId'));
  const scopedQueries = (suite.match(/where: \{ salonId/g) || []).length;
  assert.ok(scopedQueries >= 20, `esperadas pelo menos 20 consultas tenant-safe; encontradas ${scopedQueries}`);
});

test('checkout integrado não aceita referência de outro tenant', () => {
  assert.ok(checkout.includes("where: { id: appointmentId, salonId }"));
  assert.ok(checkout.includes("where: { id: data.resourceId, salonId: tenant.salonId, active: true }"));
  assert.ok(checkout.includes("salonId: tenant.salonId"));
  assert.ok(checkout.includes("clientId: appointment.clientId"));
});

test('portal público deriva o tenant exclusivamente do token persistido', () => {
  assert.ok(suite.includes("const access = await prisma.clientPortalAccess.findUnique({ where: { tokenHash: hash } })"));
  assert.ok(suite.includes("where: { id: access.clientId, salonId: access.salonId }"));
  assert.ok(suite.includes("where: { salonId: access.salonId, clientId: access.clientId }"));
  assert.ok(!suite.includes("request.query.salonId"));
  assert.ok(!suite.includes("request.params.salonId"));
});

test('multiunidade exige convite direcionado e não concede acesso operacional cruzado', () => {
  assert.ok(network.includes('targetSalonId: objectId'));
  assert.ok(network.includes('ownerSalonId: objectId'));
  assert.ok(network.includes('timingSafeEqual'));
  assert.ok(network.includes('invite.targetSalonId !== target.salonId'));
  assert.ok(network.includes("where: { id: params.id, salonId: owner.salonId, status: 'ACTIVE' }"));
  assert.ok(network.includes("O vínculo não compartilha dados operacionais entre tenants"));
  for (const forbiddenDelegate of ['prisma.client.findMany', 'prisma.appointment.findMany', 'prisma.inventoryProduct.findMany', 'prisma.financialEntry.findMany']) {
    assert.ok(!network.includes(forbiddenDelegate), `multiunidade não deve consultar ${forbiddenDelegate}`);
  }
});

test('todos os diagnósticos do Marco 35 permanecem tenant-scoped', () => {
  for (const [name, source] of [
    ['transactional', transactional],
    ['operational', operational],
    ['evolution', evolution],
    ['validation', validation]
  ]) {
    assert.ok(source.includes('salonId'), `${name} deve usar salonId`);
    assert.ok(source.includes("tenant.role !== 'ADMIN'"), `${name} deve exigir ADMIN`);
  }
});

test('Etapa 6 preserva tenant no recebimento seguro e dados sensíveis sem cache', () => {
  assert.ok(validation.includes('receivePurchaseSafely(current.salonId, id)'));
  assert.ok(validation.includes("where: { id, salonId }"));
  assert.ok(validation.includes("reply.header('Cache-Control', 'no-store')"));
  assert.ok(validation.includes('where: { salonId: tenant.salonId, clientId: client.id'));
});
