require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  rateLimitPolicyFor,
  resetRateLimitBucketsForTests
} = require('../src/middlewares/rate-limit.ts');

const ORIGINALS = {
  AUTH_LOGIN_RATE_LIMIT_PER_MINUTE: process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE,
  AUTH_REFRESH_RATE_LIMIT_PER_MINUTE: process.env.AUTH_REFRESH_RATE_LIMIT_PER_MINUTE,
  WEBHOOK_RATE_LIMIT_PER_MINUTE: process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE,
  PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE: process.env.PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE
};

test.afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINALS)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetRateLimitBucketsForTests();
});

test('login possui limite mais estrito que tráfego geral', () => {
  process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE = '7';
  process.env.RATE_LIMIT_PER_MINUTE = '180';
  assert.deepEqual(rateLimitPolicyFor('POST', '/auth/login'), { surface: 'auth-login', maxRequests: 7 });
  assert.deepEqual(rateLimitPolicyFor('GET', '/services'), { surface: 'global', maxRequests: 180 });
});

test('refresh, webhooks e escrita pública recebem superfícies próprias', () => {
  assert.equal(rateLimitPolicyFor('POST', '/auth/refresh').surface, 'auth-refresh');
  assert.equal(rateLimitPolicyFor('POST', '/webhooks/whatsapp/twilio').surface, 'webhook');
  assert.equal(rateLimitPolicyFor('POST', '/appointments').surface, 'public-write');
  assert.equal(rateLimitPolicyFor('POST', '/appointments/waitlist').surface, 'public-write');
});

test('valor inválido de ambiente não desativa rate limit', () => {
  process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE = '0';
  process.env.RATE_LIMIT_PER_MINUTE = '-1';
  assert.equal(rateLimitPolicyFor('POST', '/auth/login').maxRequests, 12);
  assert.equal(rateLimitPolicyFor('GET', '/services').maxRequests, 180);
});
