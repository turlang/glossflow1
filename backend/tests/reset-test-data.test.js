const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESET_CONFIRMATION,
  assertExecutionAllowed,
  resolveProtectedPlatformState
} = require('../scripts/reset-test-data.js');

test('dry-run nunca exige confirmação destrutiva', () => {
  assert.doesNotThrow(() => assertExecutionAllowed({
    execute: false,
    nodeEnv: 'production',
    confirmation: '',
    allowProduction: ''
  }));
});

test('execução exige frase de confirmação exata', () => {
  assert.throws(() => assertExecutionAllowed({
    execute: true,
    nodeEnv: 'development',
    confirmation: 'qualquer-coisa',
    allowProduction: ''
  }), /RESET_CONFIRM/);

  assert.doesNotThrow(() => assertExecutionAllowed({
    execute: true,
    nodeEnv: 'development',
    confirmation: RESET_CONFIRMATION,
    allowProduction: ''
  }));
});

test('produção exige segunda trava além da frase de confirmação', () => {
  assert.throws(() => assertExecutionAllowed({
    execute: true,
    nodeEnv: 'production',
    confirmation: RESET_CONFIRMATION,
    allowProduction: 'false'
  }), /ALLOW_PRODUCTION_DATA_RESET=true/);

  assert.doesNotThrow(() => assertExecutionAllowed({
    execute: true,
    nodeEnv: 'production',
    confirmation: RESET_CONFIRMATION,
    allowProduction: 'true'
  }));
});

test('proteção do reset exige SUPER_ADMIN ativo no tenant técnico', async () => {
  const previousEmail = process.env.SUPER_ADMIN_EMAIL;
  process.env.SUPER_ADMIN_EMAIL = 'owner@glossflow.test';

  try {
    const protectedState = await resolveProtectedPlatformState({
      user: {
        findUnique: async ({ where }) => {
          assert.equal(where.email, 'owner@glossflow.test');
          return {
            id: 'super-id',
            email: where.email,
            role: 'SUPER_ADMIN',
            active: true,
            salonId: 'platform-id',
            salon: { id: 'platform-id', slug: 'glossflow-platform' }
          };
        }
      }
    });

    assert.equal(protectedState.superAdmin.id, 'super-id');
    assert.equal(protectedState.platformSalon.slug, 'glossflow-platform');
  } finally {
    if (previousEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = previousEmail;
  }
});
