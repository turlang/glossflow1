import { describe, expect, it } from 'vitest';
import {
  buildRetentionKpis,
  filterRetentionClients,
  formatVisitRecency,
  retentionPriorityClass
} from './crm-retention.utils.js';

const clients = [
  { id: '1', name: 'Carla', phone: '11999999999', email: '', tags: ['BIRTHDAY', 'FREQUENT'], primarySegment: 'BIRTHDAY', reason: 'Aniversario em 2 dias', marketingAllowed: true, daysSinceLastVisit: 10 },
  { id: '2', name: 'Bianca', phone: '11888888888', email: 'bia@example.com', tags: ['INACTIVE_120'], primarySegment: 'INACTIVE_120', reason: 'Sem atendimento ha 130 dias', marketingAllowed: false, daysSinceLastVisit: 130 }
];

describe('crm retention utils', () => {
  it('filtra por segmento sem perder clientes com multiplas tags', () => {
    expect(filterRetentionClients(clients, 'FREQUENT')).toHaveLength(1);
    expect(filterRetentionClients(clients, 'FREQUENT')[0].name).toBe('Carla');
  });

  it('filtra opt-out e busca textual', () => {
    expect(filterRetentionClients(clients, 'OPT_OUT')).toHaveLength(1);
    expect(filterRetentionClients(clients, 'ALL', 'bia@example.com')[0].name).toBe('Bianca');
  });

  it('monta KPIs de reativacao com resumo do backend', () => {
    const kpis = buildRetentionKpis({ totalClients: 10, eligibleClients: 8, reactivationRate: 25, reactivated30d: 2 });
    expect(kpis.find((item) => item.label === 'Clientes').value).toBe(10);
    expect(kpis.find((item) => item.label === 'Reativacao').value).toContain('25');
  });

  it('traduz recencia e prioridade para a interface', () => {
    expect(formatVisitRecency({ daysSinceLastVisit: null })).toMatch(/Sem atendimento/i);
    expect(formatVisitRecency({ daysSinceLastVisit: 90 })).toContain('90');
    expect(retentionPriorityClass('INACTIVE_120')).toBe('critical');
  });
});
