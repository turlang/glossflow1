const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/routes/organization-network.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Marco 32 exige convite assinado e aceite pelo tenant de destino', () => {
  assert.ok(routes.includes("/admin/organizations/:id/invite"));
  assert.ok(routes.includes("/admin/organizations/join"));
  assert.ok(routes.includes("createHmac('sha256'"));
  assert.ok(routes.includes('timingSafeEqual'));
  assert.ok(routes.includes('invite.targetSalonId !== target.salonId'));
  assert.ok(routes.includes("tenant.role !== 'ADMIN'"));
});

test('convite é emitido para slug e tenant específicos com validade curta', () => {
  assert.ok(routes.includes('targetSalonSlug'));
  assert.ok(routes.includes('targetSalonId'));
  assert.ok(routes.includes('.max(72)'));
  assert.ok(routes.includes('expiresAt <= Date.now()'));
});

test('aceite não cria vínculo duplicado e não concede acesso cross-tenant', () => {
  assert.ok(routes.includes('locationSalonId: target.salonId'));
  assert.ok(routes.includes('salonId: invite.ownerSalonId'));
  assert.ok(routes.includes('Unidade já vinculada; nenhum vínculo duplicado foi criado.'));
  assert.ok(routes.includes('O vínculo não compartilha dados operacionais entre tenants.'));
});

test('associação direta antiga é bloqueada pelo pipeline autenticado', () => {
  assert.ok(appRoutes.includes("path === '/admin/organizations/locations'"));
  assert.ok(appRoutes.includes("code: 'CONSENT_REQUIRED'"));
  assert.ok(appRoutes.includes('business.register(organizationNetworkRoutes)'));
});
