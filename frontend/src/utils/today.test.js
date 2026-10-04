import { describe, expect, it } from 'vitest';
import { businessToday } from './today.js';
describe('Meu negócio hoje', () => {
  it('separa previsão de recebimento pago, exclui outros dias, faltas e cancelamentos', () => {
    const now = new Date('2026-10-04T08:00:00');
    const appointment = (id, status, day = '04') => ({
      id,
      status,
      startTime: `2026-10-${day}T09:00:00`,
      service: { price: 100 }
    });
    const entry = (amount, paid, day = '04', type = 'REVENUE') => ({
      amount,
      paid,
      type,
      referenceDate: `2026-10-${day}T12:00:00`
    });
    const result = businessToday(
      [
        appointment('done', 'COMPLETED'),
        appointment('next', 'CONFIRMED'),
        appointment('c', 'CANCELED'),
        appointment('n', 'NO_SHOW'),
        appointment('other', 'CONFIRMED', '05')
      ],
      [entry(80, true), entry(100, false), entry(90, true, '05'), entry(40, true, '04', 'EXPENSE')],
      now
    );
    expect(result.completed).toBe(1);
    expect(result.expected).toBe(200);
    expect(result.received).toBe(80);
    expect(result.next.map((a) => a.id)).toEqual(['next']);
  });
});
