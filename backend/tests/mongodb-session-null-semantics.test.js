require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.NODE_ENV = 'production';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

const salonId = '507f1f77bcf86cd799439011';
const userId = '507f191e810c19729de860ea';
const sessionId = '507f191e810c19729de860eb';

function supportsUnsetOrNullRevokedAt(where) {
  const branches = Array.isArray(where?.OR) ? where.OR : [];
  const explicitNull = branches.some((branch) => branch?.revokedAt === null);
  const missingField = branches.some((branch) => branch?.revokedAt?.isSet === false);
  return explicitNull && missingField;
}

async function withMocks(replacements, run) {
  const originals = [];
  for (const [delegate, methods] of Object.entries(replacements)) {
    for (const [method, implementation] of Object.entries(methods)) {
      originals.push([delegate, method, prisma[delegate][method]]);
      prisma[delegate][method] = implementation;
    }
  }
  try {
    return await run();
  } finally {
    for (const [delegate, method, original] of originals.reverse()) prisma[delegate][method] = original;
  }
}

test('login novo grava revokedAt null e autenticação aceita sessões Mongo legadas sem o campo', async () => {
  const password = 'SenhaSuperAdmin123!';
  const user = {
    id: userId,
    name: 'Super Admin',
    email: 'super@example.test',
    password: await bcrypt.hash(password, 4),
    role: 'SUPER_ADMIN',
    salonId,
    active: true
  };

  let createdSessionData;
  let protectedLookupWhere;
  let refreshLookupWhere;
  let refreshUpdateWhere;

  await withMocks({
    user: {
      findUnique: async () => user
    },
    userSession: {
      create: async ({ data }) => {
        createdSessionData = data;
        return {
          id: sessionId,
          ...data,
          createdAt: new Date(),
          lastUsedAt: new Date()
        };
      },
      findFirst: async ({ where }) => {
        if (where.id === sessionId) protectedLookupWhere = where;
        if (where.refreshTokenHash) refreshLookupWhere = where;
        return {
          id: sessionId,
          userId,
          salonId,
          expiresAt: new Date(Date.now() + 60_000),
          user
        };
      },
      updateMany: async ({ where }) => {
        refreshUpdateWhere = where;
        return { count: 1 };
      }
    }
  }, async () => {
    const app = buildApp();
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: user.email, password }
      });
      assert.equal(login.statusCode, 200, login.body);
      const loginBody = login.json();
      assert.equal(createdSessionData.revokedAt, null);
      assert.ok(loginBody.token);
      assert.ok(loginBody.refreshToken);

      const protectedResponse = await app.inject({
        method: 'GET',
        url: '/platform-admin/modules/catalog',
        headers: { authorization: `Bearer ${loginBody.token}` }
      });
      assert.equal(protectedResponse.statusCode, 200, protectedResponse.body);
      assert.equal(supportsUnsetOrNullRevokedAt(protectedLookupWhere), true);

      const refresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: loginBody.refreshToken }
      });
      assert.equal(refresh.statusCode, 200, refresh.body);
      assert.equal(supportsUnsetOrNullRevokedAt(refreshLookupWhere), true);
      assert.equal(supportsUnsetOrNullRevokedAt(refreshUpdateWhere), true);
    } finally {
      await app.close();
    }
  });
});
