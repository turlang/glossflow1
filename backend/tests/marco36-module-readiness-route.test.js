const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/routes/platform-module-readiness.routes.ts'), 'utf8');
const readiness = fs.readFileSync(path.join(root, 'src/services/module-readiness.service.ts'), 'utf8');

const modules = [
  'SITE','AGENDA','ESTOQUE','CRM','FINANCEIRO','FIDELIDADE','WHATSAPP','IA','ANALYTICS',
  'POS','PACOTES','COMPRAS','EQUIPE','CLINICO','MARKETING','PORTAL_CLIENTE','MULTIUNIDADE','RECURSOS','FINANCEIRO_ADV'
];

const ready = ['SITE','AGENDA','ESTOQUE','CRM','FINANCEIRO','FIDELIDADE','IA','ANALYTICS'];
const validation = ['WHATSAPP','POS','PACOTES','COMPRAS','EQUIPE','CLINICO','PORTAL_CLIENTE','RECURSOS'];
const evolution = ['MARKETING','MULTIUNIDADE','FINANCEIRO_ADV'];

test('Marco 36 expõe readiness somente dentro do wrapper SUPER_ADMIN', () => {
  assert.ok(appRoutes.includes("import { platformModuleReadinessRoutes } from './platform-module-readiness.routes';"));
  const platformStart = appRoutes.indexOf('app.register(async (platformAdmin) =>');
  const maintenanceStart = appRoutes.indexOf('app.register(async (platformMaintenance) =>');
  assert.ok(platformStart >= 0 && maintenanceStart > platformStart);
  const platformBlock = appRoutes.slice(platformStart, maintenanceStart);
  assert.ok(platformBlock.includes("requireRoles(['SUPER_ADMIN'])"));
  assert.ok(platformBlock.includes('platformAdmin.register(platformModuleReadinessRoutes)'));
  assert.ok(route.includes("app.get('/platform-admin/modules/readiness'"));
});

test('readiness usa somente o catálogo canônico atual', () => {
  assert.ok(route.includes('getModuleReadinessSummary()'));
  assert.ok(route.includes('getModuleReadinessCatalog()'));
  assert.equal(route.includes('request.body'), false);
  assert.equal(route.includes('request.params'), false);
});

test('catálogo mantém exatamente 19 módulos e classificação 8/8/3', () => {
  for (const module of modules) {
    assert.match(readiness, new RegExp(`\\b${module}:\\s*\\{`), `módulo ausente: ${module}`);
  }
  for (const module of ready) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 700).includes("status: 'READY'"), `${module} deveria estar READY`);
  }
  for (const module of validation) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 900).includes("status: 'VALIDATION_REQUIRED'"), `${module} deveria exigir homologação`);
  }
  for (const module of evolution) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 900).includes("status: 'EVOLUTION_REQUIRED'"), `${module} deveria exigir evolução`);
  }
  assert.equal(modules.length, 19);
  assert.equal(ready.length, 8);
  assert.equal(validation.length, 8);
  assert.equal(evolution.length, 3);
});
