import { describe, expect, it } from 'vitest';
import {
  appointmentsForSlot,
  buildMonthDays,
  buildRescheduleStart,
  buildWeekDays,
  calculateAgendaMetrics,
  daysInSelectedMonth,
  filterAppointmentsForView,
  isValidIsoDate,
  moveAgendaDate,
  normalizeAppointments,
  parseLocalDate,
  toLocalIsoDate
} from './agenda-enterprise.utils.js';

const professional = { id: 'p1', name: 'Ana' };
const baseAppointments = [
  { id: 'a2', professionalId: 'p1', startTime: '2026-08-12T14:00:00.000Z', service: { price: 80 } },
  { id: 'a1', professionalId: 'p1', startTime: '2026-08-11T12:00:00.000Z', service: { price: 120 } }
];

describe('agenda-enterprise.utils', () => {
  it('rejeita datas ISO inválidas', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('11/08/2026')).toBe(false);
    expect(parseLocalDate('invalid')).toBeNull();
  });

  it('preserva o dia local ao construir datas do calendário', () => {
    const date = parseLocalDate('2026-08-11');
    expect(toLocalIsoDate(date)).toBe('2026-08-11');
    expect(date.getDate()).toBe(11);
  });

  it('monta uma semana de segunda a domingo', () => {
    const days = buildWeekDays('2026-08-12');
    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe('2026-08-10');
    expect(days[6].iso).toBe('2026-08-16');
  });

  it('monta grade mensal estável de 42 dias', () => {
    const days = buildMonthDays('2026-08-11');
    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
  });

  it('usa a quantidade real de dias do mês', () => {
    expect(daysInSelectedMonth('2026-02-10')).toBe(28);
    expect(daysInSelectedMonth('2028-02-10')).toBe(29);
    expect(daysInSelectedMonth('2026-08-10')).toBe(31);
  });

  it('normaliza, filtra e ordena agendamentos por profissional', () => {
    const normalized = normalizeAppointments([...baseAppointments, { id: 'other', professionalId: 'p2', startTime: '2026-08-11T10:00:00.000Z' }], 'p1');
    expect(normalized).toHaveLength(2);
    expect(normalized[0].id).toBe('a1');
    expect(normalized.every((item) => item.dateIso && item.hourKey)).toBe(true);
  });

  it('filtra o período semanal sem carregar datas fora da semana', () => {
    const appointments = normalizeAppointments(baseAppointments);
    const weekDays = buildWeekDays(appointments[0].dateIso);
    const visible = filterAppointmentsForView({ appointments, viewMode: 'week', selectedDate: appointments[0].dateIso, weekDays });
    expect(visible.map((item) => item.id)).toEqual(['a1', 'a2']);
  });

  it('calcula potencial, capacidade e ocupação mensal pela duração real do mês', () => {
    const appointments = normalizeAppointments(baseAppointments);
    const metrics = calculateAgendaMetrics({ appointments, professionals: [professional], viewMode: 'month', selectedDate: '2026-08-11', hours: ['08:00', '09:00'] });
    expect(metrics.potential).toBe(200);
    expect(metrics.capacity).toBe(62);
    expect(metrics.occupancy).toBe(3);
  });

  it('limita o dia 31 ao último dia do mês seguinte', () => {
    expect(moveAgendaDate('2026-01-31', 1, 'month')).toBe('2026-02-28');
    expect(moveAgendaDate('2028-01-31', 1, 'month')).toBe('2028-02-29');
  });

  it('constrói horário de reagendamento e encontra o slot correspondente', () => {
    const start = buildRescheduleStart('2026-08-11', '09:30');
    expect(start).not.toBeNull();
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(30);

    const appointments = [{ id: 'a1', dateIso: '2026-08-11', hourKey: '09:00', professionalId: 'p1' }];
    expect(appointmentsForSlot(appointments, { dateIso: '2026-08-11', hour: '09:00', professional })).toHaveLength(1);
  });
});
