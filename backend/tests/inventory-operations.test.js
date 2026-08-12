require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');
const { inventoryMovementSchema } = require('../src/routes/schemas.ts');

const salonId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';

function token(role = 'ADMIN') {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: `${role.toLowerCase()}@teste.local`,
    role,
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function enabledSalon() {
  return { modulesConfigured: true, enabledModules: ['ESTOQUE'] };
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

test('overview do estoque calcula capital, ruptura e plano de reposição por tenant', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      inventoryProduct: {
        findMany: async ({ where }) => {
          assert.deepEqual(where, { salonId, active: true });
          return [
            { id: productId, name: 'Shampoo', category: 'Cabelo', supplier: 'A', unit: 'un', quantity: 1, minimumQuantity: 2, costPrice: 20, salePrice: 35 },
            { id: '507f1f77bcf86cd799439013', name: 'Máscara', category: 'Cabelo', supplier: 'B', unit: 'un', quantity: 0, minimumQuantity: 3, costPrice: 15, salePrice: 30 },
            { id: '507f1f77bcf86cd799439014', name: 'Óleo', category: 'Finalização', supplier: 'A', unit: 'un', quantity: 5, minimumQuantity: 2, costPrice: 10, salePrice: null }
          ];
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/inventory/overview',
        headers: { authorization: `Bearer ${token()}` }
      });

      assert.equal(response.statusCode, 200, response.body);
      const body = response.json();
      assert.equal(body.summary.activeProducts, 3);
      assert.equal(body.summary.lowStock, 2);
      assert.equal(body.summary.outOfStock, 1);
      assert.equal(body.summary.totalCostValue, 70);
      assert.equal(body.summary.potentialSaleValue, 35);
      assert.equal(body.summary.estimatedRestockCost, 150);
      assert.equal(body.restock[0].status, 'OUT');
      assert.equal(body.restock[0].recommendedQuantity, 6);
      assert.equal(body.restock[1].recommendedQuantity, 3);
    });
  } finally {
    await app.close();
  }
});

test('histórico do produto consulta somente movimentos do tenant e limita a 100 registros', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      inventoryProduct: {
        findFirst: async ({ where }) => {
          assert.equal(where.id, productId);
          assert.equal(where.salonId, salonId);
          return { id: productId, name: 'Shampoo', unit: 'un', quantity: 4, active: true };
        }
      },
      inventoryMovement: {
        findMany: async ({ where, take }) => {
          assert.deepEqual(where, { productId, salonId });
          assert.equal(take, 100);
          return [{ id: 'm1', type: 'IN', quantity: 4, reason: 'Compra', createdAt: new Date('2026-08-12T10:00:00.000Z') }];
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/admin/inventory/${productId}/movements`,
        headers: { authorization: `Bearer ${token('RECEPTION')}` }
      });

      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().product.id, productId);
      assert.equal(response.json().movements.length, 1);
    });
  } finally {
    await app.close();
  }
});

test('PROFESSIONAL não acessa visão operacional de reposição', async () => {
  const app = buildApp();
  try {
    await withMocks({ salon: { findUnique: async () => enabledSalon() } }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/inventory/overview',
        headers: { authorization: `Bearer ${token('PROFESSIONAL')}` }
      });
      assert.equal(response.statusCode, 403, response.body);
    });
  } finally {
    await app.close();
  }
});

test('ajuste físico pode reconciliar o saldo para zero', () => {
  const result = inventoryMovementSchema.parse({
    productId,
    type: 'ADJUSTMENT',
    quantity: 0,
    reason: 'Contagem física'
  });
  assert.equal(result.quantity, 0);
});

test('entrada ou saída com quantidade zero continua inválida', () => {
  assert.throws(() => inventoryMovementSchema.parse({
    productId,
    type: 'OUT',
    quantity: 0,
    reason: 'Inválido'
  }));
});
