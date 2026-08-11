require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');
const { validTwilioSignature } = require('../src/services/twilio-whatsapp/security.ts');

const salonId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const clientId = '507f1f77bcf86cd799439013';

function token(role = 'ADMIN') {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: 'admin@teste.local',
    role,
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
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

function enabledSalon() {
  return { modulesConfigured: true, enabledModules: ['AGENDA', 'ESTOQUE', 'CRM', 'WHATSAPP', 'IA'] };
}

test('estoque cria produto e movimento inicial no tenant autenticado', async () => {
  const app = buildApp();
  let productData = null;
  let movementData = null;
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      inventoryProduct: {
        create: async ({ data }) => {
          productData = data;
          return { id: productId, ...data };
        }
      },
      inventoryMovement: {
        create: async ({ data }) => {
          movementData = data;
          return { id: 'm1', ...data };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/inventory',
        headers: { authorization: `Bearer ${token()}` },
        payload: {
          name: 'Shampoo',
          category: 'Cabelo',
          supplier: 'Fornecedor',
          unit: 'un',
          quantity: 5,
          minimumQuantity: 2,
          costPrice: 20,
          salePrice: 35,
          imageUrl: '',
          active: true
        }
      });
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(productData.salonId, salonId);
      assert.equal(movementData.salonId, salonId);
      assert.equal(movementData.productId, productId);
      assert.equal(movementData.type, 'IN');
      assert.equal(movementData.quantity, 5);
    });
  } finally {
    await app.close();
  }
});

test('estoque impede saída que deixaria saldo negativo', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      inventoryProduct: {
        findFirst: async ({ where }) => {
          assert.equal(where.salonId, salonId);
          return { id: productId, salonId, name: 'Shampoo', quantity: 2, active: true };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/inventory/movements',
        headers: { authorization: `Bearer ${token()}` },
        payload: { productId, type: 'OUT', quantity: 3, reason: 'Uso interno' }
      });
      assert.equal(response.statusCode, 400);
      assert.match(response.json().message, /negativo/i);
    });
  } finally {
    await app.close();
  }
});

test('CRM cria cliente somente no salão autenticado', async () => {
  const app = buildApp();
  let created = null;
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        create: async ({ data }) => {
          created = data;
          return { id: clientId, ...data };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/clients',
        headers: { authorization: `Bearer ${token()}` },
        payload: {
          name: 'Carla Silva',
          phone: '11999999999',
          email: 'carla@example.com',
          birthDate: '1995-05-10',
          notes: 'Prefere manhã',
          preferences: 'Corte curto'
        }
      });
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(created.salonId, salonId);
      assert.equal(created.name, 'Carla Silva');
      assert.ok(created.birthDate instanceof Date);
    });
  } finally {
    await app.close();
  }
});

test('CRM não atualiza cliente de outro tenant', async () => {
  const app = buildApp();
  try {
    await withMocks({
      salon: { findUnique: async () => enabledSalon() },
      client: {
        updateMany: async ({ where }) => {
          assert.equal(where.id, clientId);
          assert.equal(where.salonId, salonId);
          return { count: 0 };
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/clients/${clientId}`,
        headers: { authorization: `Bearer ${token()}` },
        payload: {
          name: 'Cliente externo',
          phone: '11911112222',
          email: '',
          birthDate: '',
          notes: '',
          preferences: ''
        }
      });
      assert.equal(response.statusCode, 404);
      assert.match(response.json().message, /neste salão/i);
    });
  } finally {
    await app.close();
  }
});

test('assinatura Twilio aceita payload íntegro independentemente da ordem das chaves', () => {
  const url = 'https://api.example.com/webhooks/whatsapp/twilio';
  const tokenValue = 'twilio-auth-token';
  const params = { To: 'whatsapp:+551100000000', Body: 'Olá', From: 'whatsapp:+551199999999' };
  const signed = Object.keys(params).sort().reduce((value, key) => `${value}${key}${params[key]}`, url);
  const signature = crypto.createHmac('sha1', tokenValue).update(signed).digest('base64');
  assert.equal(validTwilioSignature(url, params, signature, tokenValue), true);
});

test('assinatura Twilio rejeita alteração do corpo assinado', () => {
  const url = 'https://api.example.com/webhooks/whatsapp/twilio';
  const tokenValue = 'twilio-auth-token';
  const original = { Body: 'Mensagem original', From: 'whatsapp:+551199999999' };
  const signed = Object.keys(original).sort().reduce((value, key) => `${value}${key}${original[key]}`, url);
  const signature = crypto.createHmac('sha1', tokenValue).update(signed).digest('base64');
  assert.equal(validTwilioSignature(url, { ...original, Body: 'Mensagem alterada' }, signature, tokenValue), false);
});
