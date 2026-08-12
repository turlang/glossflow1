require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
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

function token(role = 'ADMIN') {
  return jwt.sign({
    id: '507f191e810c19729de860ea',
    email: 'admin@teste.local',
    role,
    salonId
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function salonLookup({ select } = {}) {
  if (select?.modulesConfigured) return { modulesConfigured: true, enabledModules: ['AGENDA'] };
  if (select?.name && !select?.openingHours) return { name: salon.name };
  return salon;
}

async function withMocks({ prismaMocks = {}, serviceMocks = [] }, run) {
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

function currentAppointment() {
  return {
    id: appointmentId,
    salonId,
    clientId,
    clientName: 'Carla Silva',
    clientPhone: '11999999999',
    clientEmail: 'carla@example.com',
    professionalId,
    startTime: new Date('2026-08-20T15:00:00.000Z'),
    endTime: new Date('2026-08-20T16:00:00.000Z'),
    status: 'CONFIRMED',
    service,
    professional
  };
}

test('Agenda comercial cria atendimento rápido e informa entrega ao cliente', async () => {
  const app = buildApp();
  let createData = null;
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async (args) => salonLookup(args) },
        service: { findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return service; } },
        professional: { findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return professional; } },
        appointment: {
          findFirst: async () => null,
          create: async ({ data }) => {
            createData = data;
            return { id: appointmentId, ...data, service, professional };
          }
        },
        client: {
          findFirst: async ({ where }) => { assert.equal(where.salonId, salonId); return null; },
          create: async ({ data }) => ({ id: clientId, ...data })
        }
      },
      serviceMocks: [[notificationService, {
        createAppointmentManagementAccess: async () => ({ token: 'x'.repeat(64), url: '/?action=manage-booking' }),
        notifyAppointmentCreated: async () => ({ ok: true })
      }]]
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/appointments/quick-create',
        headers: { authorization: `Bearer ${token('RECEPTION')}` },
        payload: {
          clientName: 'Carla Silva',
          clientPhone: '(11) 99999-9999',
          clientEmail: 'carla@example.com',
          serviceId,
          professionalId,
          startTime: '2026-08-20T15:00:00.000Z',
          notes: 'Criado pela recepção'
        }
      });

      assert.equal(response.statusCode, 201, response.body);
      assert.equal(createData.salonId, salonId);
      assert.equal(createData.clientPhone, '11999999999');
      assert.equal(response.json().confirmation.clientNotification, 'SENT');
      assert.equal(response.json().confirmation.confirmed, true);
    });
  } finally {
    await app.close();
  }
});

test('Agenda comercial bloqueia criação rápida quando o profissional já está ocupado', async () => {
  const app = buildApp();
  let creates = 0;
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async (args) => salonLookup(args) },
        service: { findFirst: async () => service },
        professional: { findFirst: async () => professional },
        appointment: {
          findFirst: async () => ({ id: '507f1f77bcf86cd799439099' }),
          create: async () => { creates += 1; return {}; }
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/appointments/quick-create',
        headers: { authorization: `Bearer ${token('ADMIN')}` },
        payload: {
          clientName: 'Cliente conflito',
          clientPhone: '11988887777',
          serviceId,
          professionalId,
          startTime: '2026-08-20T15:00:00.000Z',
          notes: ''
        }
      });

      assert.equal(response.statusCode, 409, response.body);
      assert.match(response.json().message, /ocupando parte desse período/i);
      assert.equal(creates, 0);
    });
  } finally {
    await app.close();
  }
});

test('reagendamento comercial explica conflito antes de persistir a mudança', async () => {
  const app = buildApp();
  const current = currentAppointment();
  let updates = 0;
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async (args) => salonLookup(args) },
        professional: { findFirst: async () => professional },
        appointment: {
          findFirst: async ({ where }) => where.id === appointmentId ? current : { id: '507f1f77bcf86cd799439099' },
          update: async () => { updates += 1; return current; }
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/appointments/${appointmentId}`,
        headers: { authorization: `Bearer ${token('RECEPTION')}` },
        payload: {
          startTime: '2026-08-20T17:00:00.000Z',
          professionalId,
          status: 'CONFIRMED'
        }
      });

      assert.equal(response.statusCode, 409, response.body);
      assert.match(response.json().message, /já possui agendamento neste horário/i);
      assert.equal(updates, 0);
    });
  } finally {
    await app.close();
  }
});

test('cancelamento pela equipe avisa o cliente e dispara reaproveitamento da vaga', async () => {
  const app = buildApp();
  const current = currentAppointment();
  let notified = false;
  let waitlistTriggered = false;
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async (args) => salonLookup(args) },
        appointment: {
          findFirst: async () => current,
          update: async ({ data }) => ({ ...current, ...data })
        }
      },
      serviceMocks: [
        [notificationService, {
          notifyAppointmentCancelled: async () => { notified = true; return { ok: true }; }
        }],
        [waitlistService, {
          matchWaitlistAfterAppointmentChange: async ({ salonId: receivedSalonId }) => {
            assert.equal(receivedSalonId, salonId);
            waitlistTriggered = true;
            return null;
          }
        }]
      ]
    }, async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/appointments/${appointmentId}`,
        headers: { authorization: `Bearer ${token('ADMIN')}` },
        payload: { status: 'CANCELED' }
      });

      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().status, 'CANCELED');
      assert.equal(notified, true);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(waitlistTriggered, true);
    });
  } finally {
    await app.close();
  }
});

test('mesa operacional consolida presença, confirmação e lembretes por agendamento', async () => {
  const app = buildApp();
  let auditReads = 0;
  try {
    await withMocks({
      prismaMocks: {
        salon: { findUnique: async (args) => salonLookup(args) },
        service: { findMany: async ({ where }) => { assert.equal(where.salonId, salonId); return [service]; } },
        auditLog: {
          findMany: async ({ where }) => {
            auditReads += 1;
            assert.equal(where.salonId, salonId);
            if (where.resource === 'AppointmentAttendance') {
              return [{ resourceId: appointmentId, metadata: { status: 'ARRIVED' } }];
            }
            if (where.resource === 'AppointmentClientConfirmation') {
              return [{ resourceId: appointmentId, createdAt: new Date('2026-08-20T12:00:00.000Z') }];
            }
            return [
              { resourceId: appointmentId, action: 'REMINDER_24H_SENT', createdAt: new Date('2026-08-19T15:00:00.000Z') },
              { resourceId: appointmentId, action: 'REMINDER_2H_SENT', createdAt: new Date('2026-08-20T13:00:00.000Z') }
            ];
          }
        }
      }
    }, async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/appointments/operational-options',
        headers: { authorization: `Bearer ${token('RECEPTION')}` }
      });

      assert.equal(response.statusCode, 200, response.body);
      const body = response.json();
      assert.equal(body.role, 'RECEPTION');
      assert.equal(body.attendanceByAppointment[appointmentId], 'ARRIVED');
      assert.ok(body.confirmationByAppointment[appointmentId]);
      assert.ok(body.reminderByAppointment[appointmentId].main);
      assert.ok(body.reminderByAppointment[appointmentId].short);
      assert.equal(auditReads, 3);
    });
  } finally {
    await app.close();
  }
});
