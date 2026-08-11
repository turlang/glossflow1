require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';
process.env.BUSINESS_TIMEZONE = 'America/Sao_Paulo';
process.env.BUSINESS_TIMEZONE_OFFSET = '-03:00';

const { buildApp } = require('../src/app.ts');
const { prisma } = require('../src/lib/prisma.ts');
const notificationService = require('../src/services/appointment-notification.service.ts');
const waitlistService = require('../src/services/waitlist.service.ts');

const salonId = '507f1f77bcf86cd799439011';
const serviceId = '507f1f77bcf86cd799439012';
const professionalId = '507f1f77bcf86cd799439013';
const appointmentId = '507f1f77bcf86cd799439014';
const clientId = '507f1f77bcf86cd799439015';

const salon = {
  id: salonId,
  slug: 'glossflow',
  name: 'GlossFlow Teste',
  customDomain: null,
  description: 'Salão de testes',
  whatsapp: '5511999999999',
  openingHours: '08h às 20h',
  modulesConfigured: true,
  enabledModules: ['AGENDA']
};
const service = { id: serviceId, salonId, name: 'Corte', durationMin: 60, price: 120, active: true };
const professional = {
  id: professionalId,
  salonId,
  name: 'Ana',
  specialty: 'Cabelo',
  active: true,
  servicesConfigured: false,
  serviceIds: [],
  workScheduleConfigured: false,
  weeklySchedule: null,
  timeBlocks: null
};

function authToken() {
  return jwt.sign({ id: '507f191e810c19729de860ea', email: 'admin@teste.local', role: 'ADMIN', salonId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

async function withMocks({ prismaMocks = {}, serviceMocks = {} }, run) {
  const originals = [];
  for (const [delegate, methods] of Object.entries(prismaMocks)) {
    for (const [method, implementation] of Object.entries(methods)) {
      originals.push({ target: prisma[delegate], method, original: prisma[delegate][method] });
      prisma[delegate][method] = implementation;
    }
  }
  for (const [target, methods] of serviceMocks) {
    for (const [method, implementation] of Object.entries(methods)) {
      originals.push({ target, method, original: target[method] });
      target[method] = implementation;
    }
  }
  try {
    return await run();
  } finally {
    for (const item of originals.reverse()) item.target[item.method] = item.original;
  }
}

test('criação pública persiste cliente e agendamento somente no salão resolvido', async () => {
  const app = buildApp();
  let appointmentCreateData = null;
  const startTime = '2026-08-20T15:00:00.000Z';
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async () => salon },
        service: { findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return service; } },
        professional: { findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return professional; } },
        appointment: {
          findFirst: async () => null,
          create: async ({ data }) => {
            appointmentCreateData = data;
            return { id: appointmentId, ...data };
          }
        },
        client: {
          findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return null; },
          create: async ({ data }) => ({ id: clientId, ...data })
        }
      },
      serviceMocks: [[notificationService, {
        createAppointmentManagementAccess: async () => ({ token: 'a'.repeat(64), url: '/?manage=1' }),
        notifyAppointmentCreated: async () => ({ ok: true })
      }]]
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/appointments',
        payload: {
          clientName: 'Carla Silva',
          clientPhone: '(11) 99999-9999',
          clientEmail: 'carla@example.com',
          serviceId,
          professionalId,
          startTime,
          notes: 'Teste'
        }
      });
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(appointmentCreateData.salonId, salonId);
      assert.equal(appointmentCreateData.clientPhone, '11999999999');
      assert.equal(appointmentCreateData.professionalId, professionalId);
      assert.equal(response.json().confirmation.clientNotification, 'SENT');
    });
  } finally {
    await app.close();
  }
});

test('reagendamento autenticado valida conflito e persiste novo profissional/horário', async () => {
  const app = buildApp();
  const nextProfessionalId = '507f1f77bcf86cd799439099';
  const nextProfessional = { ...professional, id: nextProfessionalId, name: 'Bia' };
  const current = {
    id: appointmentId,
    salonId,
    clientName: 'Carla Silva',
    clientPhone: '11999999999',
    professionalId,
    startTime: new Date('2026-08-20T15:00:00.000Z'),
    endTime: new Date('2026-08-20T16:00:00.000Z'),
    status: 'CONFIRMED',
    service,
    professional
  };
  let updateData = null;

  try {
    await withMocks({
      prismaMocks: {
        salon: {
          findUnique: async ({ select }) => select?.modulesConfigured
            ? { modulesConfigured: true, enabledModules: ['AGENDA'] }
            : { openingHours: salon.openingHours }
        },
        appointment: {
          findFirst: async ({ where }) => where.id === appointmentId ? current : null,
          update: async ({ data }) => { updateData = data; return { ...current, ...data, professional: nextProfessional }; }
        },
        professional: { findFirst: async ({ where }) => where.id === nextProfessionalId ? nextProfessional : null }
      },
      serviceMocks: [
        [notificationService, { createOperationalNotification: async () => ({ id: 'n1' }) }],
        [waitlistService, { matchWaitlistAfterAppointmentChange: async () => null }]
      ]
    }, async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/appointments/${appointmentId}`,
        headers: { authorization: `Bearer ${authToken()}` },
        payload: {
          startTime: '2026-08-20T17:00:00.000Z',
          professionalId: nextProfessionalId,
          status: 'CONFIRMED'
        }
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(updateData.professionalId, nextProfessionalId);
      assert.equal(updateData.startTime.toISOString(), '2026-08-20T17:00:00.000Z');
      assert.equal(updateData.endTime.toISOString(), '2026-08-20T18:00:00.000Z');
    });
  } finally {
    await app.close();
  }
});

test('cancelamento por token secreto valida hash, cancela e libera a vaga', async () => {
  const app = buildApp();
  const secretToken = 'b'.repeat(64);
  const tokenHash = crypto.createHash('sha256').update(secretToken).digest('hex');
  const current = {
    id: appointmentId,
    salonId,
    clientName: 'Carla Silva',
    clientPhone: '11999999999',
    startTime: new Date('2026-08-20T15:00:00.000Z'),
    endTime: new Date('2026-08-20T16:00:00.000Z'),
    status: 'CONFIRMED',
    service,
    professional
  };
  let statusSaved = '';
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async () => salon },
        auditLog: {
          findFirst: async () => ({ metadata: { tokenHash } })
        },
        appointment: {
          findFirst: async () => current,
          update: async ({ data }) => { statusSaved = data.status; return { ...current, ...data }; }
        }
      },
      serviceMocks: [
        [notificationService, { notifyAppointmentCancelled: async () => ({ ok: true }) }],
        [waitlistService, { matchWaitlistAfterAppointmentChange: async () => null }]
      ]
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/appointments/cancel',
        payload: { appointmentId, token: secretToken }
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(statusSaved, 'CANCELED');
      assert.equal(response.json().cancelled, true);
      assert.equal(response.json().clientNotification, 'SENT');
    });
  } finally {
    await app.close();
  }
});
