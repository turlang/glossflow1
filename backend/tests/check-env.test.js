const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'scripts', 'check-env.js');

test('check-env falha sem variáveis obrigatórias', () => {
  const result = spawnSync(process.execPath, [script], { env: {}, cwd: __dirname, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DATABASE_URL/);
});

test('check-env aceita JWT forte e DATABASE_URL', () => {
  const result = spawnSync(process.execPath, [script], {
    env: { DATABASE_URL: 'mongodb://localhost:27017/glossflow', JWT_SECRET: 'x'.repeat(48) },
    cwd: __dirname,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Ambiente validado/);
});
