const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts/provision-qa-tenant.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Marco 36 QA bootstrap exige guards explícitos', () => {
  assert.ok(script.includes("QA_TENANT_BOOTSTRAP_ENABLED !== 'true'"));
  assert.ok(script.includes("QA_ENVIRONMENT || '').toLowerCase() !== 'qa'"));
  assert.ok(script.includes('CREATE_ISOLATED_QA_TENANT'));
  assert.ok(script.includes("QA_DATABASE_NAME"));
  assert.ok(script.includes('actualDatabase !== expectedDatabase'));
});

test('bootstrap QA não executa reset destrutivo', () => {
  assert.equal(script.includes('deleteMany('), false);
  assert.equal(script.includes('reset-test-data'), false);
  assert.equal(script.includes('prisma/seed.js'), false);
});

test('bootstrap QA reutiliza ciclo SaaS canônico e os 19 módulos', () => {
  assert.ok(script.includes('provisionTenant'));
  assert.ok(script.includes('updateTenantLifecycle'));
  assert.ok(script.includes('updateTenantOwner'));
  assert.ok(script.includes('SALON_MODULES'));
  assert.ok(script.includes('enabledModules: [...SALON_MODULES]'));
});

test('bootstrap QA é idempotente por slug e não imprime senha', () => {
  assert.ok(script.includes('prisma.salon.findUnique({ where: { slug } })'));
  assert.ok(script.includes('reused: true'));
  assert.equal(script.includes('adminPassword,'), false);
});

test('package expõe comando QA dedicado', () => {
  assert.equal(pkg.scripts['qa:bootstrap'], 'node -r ts-node/register/transpile-only scripts/provision-qa-tenant.ts');
});
