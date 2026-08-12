require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');

const salonId = '507f1f77bcf86cd799439011';

function token() {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: 'admin@teste.local',
    role: 'ADMIN',
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

test('CRM paginado aplica skip/take e isolamento pelo tenant autenticado', async () => {
  const app = buildApp();
  const originalSalonFindUnique = prisma.salon.findUnique;
  const originalClientFindMany = prisma.client.findMany;
  const originalClientCount = prisma.client.count;
  let capturedFindMany = null;
  let capturedCount = null;

  prisma.salon.findUnique = async () => ({
    subscription: null,
    modulesConfigured: true,
    enabledModules: ['CRM']
  });
  prisma.client.findMany = async (args) => {
    capturedFindMany = args;
    return [{ id: '507f1f77bcf86cd799439012', name: 'Cliente 21', salonId }];
  };
  prisma.client.count = async (args) => {
    capturedCount = args;
    return 101;
  };

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/clients/paginated?page=3&limit=20',
      headers: { authorization: `Bearer ${token()}` }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(capturedFindMany.where.salonId, salonId);
    assert.equal(capturedFindMany.skip, 40);
    assert.equal(capturedFindMany.take, 20);
    assert.equal(capturedCount.where.salonId, salonId);

    const body = response.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.pagination.page, 3);
    assert.equal(body.pagination.limit, 20);
    assert.equal(body.pagination.total, 101);
    assert.equal(body.pagination.pages, 6);
    assert.equal(body.pagination.hasNext, true);
    assert.equal(body.pagination.hasPrevious, true);
  } finally {
    prisma.salon.findUnique = originalSalonFindUnique;
    prisma.client.findMany = originalClientFindMany;
    prisma.client.count = originalClientCount;
    await app.close();
  }
});
