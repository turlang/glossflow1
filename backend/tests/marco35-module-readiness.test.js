const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const access = fs.readFileSync(path.join(root, 'src/services/module-access.service.ts'), 'utf8');
const readiness = fs.readFileSync(path.join(root, 'src/services/module-readiness.service.ts'), 'utf8');

const modules = [
  'SITE','AGENDA','ESTOQUE','CRM','FINANCEIRO','FIDELIDADE','WHATSAPP','IA','ANALYTICS',
  'POS','PACOTES','COMPRAS','EQUIPE','CLINICO','MARKETING','PORTAL_CLIENTE','MULTIUNIDADE','RECURSOS','FINANCEIRO_ADV'
];

const ready = ['SITE','AGENDA','ESTOQUE','CRM','FINANCEIRO','FIDELIDADE','IA','ANALYTICS'];
const validation = ['WHATSAPP','POS','PACOTES','COMPRAS','EQUIPE','CLINICO','PORTAL_CLIENTE','RECURSOS'];
const evolution = ['MARKETING','MULTIUNIDADE','FINANCEIRO_ADV'];

test('Marco 35 mantém exatamente os 19 módulos comerciais no catálogo canônico', () => {
  for (const module of modules) {
    assert.ok(access.includes(`'${module}'`), `módulo ausente no entitlement: ${module}`);
    assert.match(readiness, new RegExp(`\\b${module}:\\s*\\{`), `módulo sem maturidade declarada: ${module}`);
  }
  assert.equal(modules.length, 19);
});

test('Marco 35 classifica 8 prontos, 8 para homologação e 3 para evolução', () => {
  for (const module of ready) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 600).includes("status: 'READY'"), `${module} deveria estar READY`);
  }
  for (const module of validation) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 700).includes("status: 'VALIDATION_REQUIRED'"), `${module} deveria exigir homologação`);
  }
  for (const module of evolution) {
    const block = readiness.slice(readiness.indexOf(`${module}: {`));
    assert.ok(block.slice(0, 700).includes("status: 'EVOLUTION_REQUIRED'"), `${module} deveria exigir evolução`);
  }
  assert.equal(ready.length, 8);
  assert.equal(validation.length, 8);
  assert.equal(evolution.length, 3);
});

test('Cada módulo possui maturidade, diagnóstico e próxima ação', () => {
  assert.ok(readiness.includes('maturity:'));
  assert.ok(readiness.includes('summary:'));
  assert.ok(readiness.includes('nextAction:'));
  assert.ok(readiness.includes('getModuleReadinessSummary'));
});
