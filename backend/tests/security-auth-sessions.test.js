require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

const salonId = '507f1f77bcf86cd799439011';
const userId = '507f191e810c19729de860ea';
const sessionId = '507f191e810c19729de860eb';

function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signedToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
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

test('refresh token é rotacionado e o token anterior deixa de funcionar', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const firstRefreshToken = 'refresh-token-original';
  let currentHash = hashToken(firstRefreshToken);

  const user = {
    id: userId,
    name: 'Super Admin',
    email: 'super@example.test',
    role: 'SUPER_ADMIN',
    salonId,
    active: true
  };

  await withMocks({
    userSession: {
      findFirst: async ({ where }) => {
        if (where.refreshTokenHash !== currentHash) return null;
        return { id: sessionId, salonId, userId, user, expiresAt: new Date(Date.now() + 60_000) };
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== sessionId || where.refreshTokenHash !== currentHash) return { count: 0 };
        currentHash = data.refreshTokenHash;
        return { count: 1 };
      }
    }
  }, async () => {
    const app = buildApp();
    try {
      const first = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: firstRefreshToken }
      });
      assert.equal(first.statusCode, 200, first.body);
      const body = first.json();
      assert.ok(body.token);
      assert.ok(body.refreshToken);
      assert.notEqual(body.refreshToken, firstRefreshToken);
      assert.equal(hashToken(body.refreshToken), currentHash);

      const accessPayload = jwt.verify(body.token, process.env.JWT_SECRET);
      assert.equal(accessPayload.sessionId, sessionId);

      const replay = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: firstRefreshToken }
      });
      assert.equal(replay.statusCode, 401, replay.body);
    } finally {
      await app.close();
    }
  });

  process.env.NODE_ENV = originalNodeEnv;
});

test('sessão revogada invalida imediatamente access token vinculado', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const token = signedToken({
    id: userId,
    email: 'admin@example.test',
    role: 'ADMIN',
    salonId,
    sessionId
  });

  await withMocks({
    userSession: { findFirst: async () => null }
  }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/security/overview',
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(response.statusCode, 401, response.body);
    } finally {
      await app.close();
    }
  });

  process.env.NODE_ENV = originalNodeEnv;
});

test('papel atual do banco substitui papel privilegiado antigo do JWT', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const token = signedToken({
    id: userId,
    email: 'old-super@example.test',
    role: 'SUPER_ADMIN',
    salonId,
    sessionId
  });

  await withMocks({
    userSession: {
      findFirst: async () => ({
        id: sessionId,
        salonId,
        userId,
        user: {
          id: userId,
          email: 'admin@example.test',
          role: 'ADMIN',
          salonId,
          active: true
        }
      })
    }
  }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/platform-admin/modules/catalog',
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(response.statusCode, 403, response.body);
    } finally {
      await app.close();
    }
  });

  process.env.NODE_ENV = originalNodeEnv;
});

test('produção rejeita access token legado sem sessionId', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const token = signedToken({
    id: userId,
    email: 'admin@example.test',
    role: 'ADMIN',
    salonId
  });

  const app = buildApp();
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/security/overview',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(response.statusCode, 401, response.body);
  } finally {
    await app.close();
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('logout por access token revoga a sessão exata mesmo sem refresh token e com JWT expirado', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const expiredToken = jwt.sign({
    id: userId,
    email: 'super@example.test',
    role: 'SUPER_ADMIN',
    salonId,
    sessionId
  }, process.env.JWT_SECRET, { expiresIn: -1 });

  const updates = [];

  try {
    await withMocks({
      userSession: {
        updateMany: async (args) => {
          updates.push(args);
          return { count: 1 };
        }
      }
    }, async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/logout',
          headers: { authorization: `Bearer ${expiredToken}` },
          payload: {}
        });

        assert.equal(response.statusCode, 204, response.body);
        assert.equal(updates.length, 1);
        assert.equal(updates[0].where.id, sessionId);
        assert.equal(updates[0].where.userId, userId);
        assert.equal(updates[0].where.salonId, salonId);
        assert.ok(Array.isArray(updates[0].where.OR));
        assert.deepEqual(updates[0].where.OR, [
          { revokedAt: null },
          { revokedAt: { isSet: false } }
        ]);
        assert.ok(updates[0].data.revokedAt instanceof Date);
      } finally {
        await app.close();
      }
    });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
