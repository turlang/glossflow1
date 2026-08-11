require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAppointmentConflictWhere,
  changesAppointmentSchedule,
  resolveAppointmentSchedule
} = require('../src/services/appointment-reschedule.service.ts');
const { appointmentUpdateSchema } = require('../src/routes/appointments/contracts.ts');

test('reagendamento detecta alteração de data ou profissional', () => {
  assert.equal(changesAppointmentSchedule({ status: 'CONFIRMED' }), false);
  assert.equal(changesAppointmentSchedule({ startTime: '2026-08-20T12:00:00.000Z' }), true);
  assert.equal(changesAppointmentSchedule({ professionalId: '507f1f77bcf86cd799439011' }), true);
});

test('reagendamento resolve início, fim e profissional efetivos', () => {
  const current = {
    startTime: new Date('2026-08-20T12:00:00.000Z'),
    professionalId: '507f1f77bcf86cd799439011'
  };
  const resolved = resolveAppointmentSchedule({
    current,
    data: {
      startTime: '2026-08-20T15:30:00.000Z',
      professionalId: '507f191e810c19729de860ea'
    },
    durationMin: 90
  });
  assert.equal(resolved.start.toISOString(), '2026-08-20T15:30:00.000Z');
  assert.equal(resolved.end.toISOString(), '2026-08-20T17:00:00.000Z');
  assert.equal(resolved.professionalId, '507f191e810c19729de860ea');
});

test('filtro de conflito exige as duas condições de sobreposição com AND', () => {
  const start = new Date('2026-08-20T12:00:00.000Z');
  const end = new Date('2026-08-20T13:00:00.000Z');
  const where = buildAppointmentConflictWhere({
    appointmentId: '507f1f77bcf86cd799439012',
    salonId: '507f1f77bcf86cd799439013',
    professionalId: '507f1f77bcf86cd799439014',
    start,
    end
  });

  assert.equal(Array.isArray(where.AND), true);
  assert.equal(where.AND.length, 2);
  assert.deepEqual(where.AND[0], { startTime: { lt: end } });
  assert.deepEqual(where.AND[1], { endTime: { gt: start } });
  assert.equal(where.OR, undefined);
});

test('contrato de atualização rejeita payload vazio', () => {
  const result = appointmentUpdateSchema.safeParse({});
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /ao menos um campo/i);
});

test('contrato de atualização rejeita campos desconhecidos', () => {
  const result = appointmentUpdateSchema.safeParse({
    status: 'CONFIRMED',
    salonId: '507f1f77bcf86cd799439099'
  });
  assert.equal(result.success, false);
  assert.equal(result.error.issues.some((issue) => issue.code === 'unrecognized_keys'), true);
});
