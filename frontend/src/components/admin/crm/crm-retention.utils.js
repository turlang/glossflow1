export const RETENTION_SEGMENTS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'BIRTHDAY', label: 'Aniversario' },
  { value: 'INACTIVE_120', label: 'Inativos 120+ dias' },
  { value: 'INACTIVE_60', label: 'Inativos 60+ dias' },
  { value: 'FREQUENT', label: 'Frequentes' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'OPT_OUT', label: 'Sem comunicacoes' }
];

export const RETENTION_LABELS = {
  BIRTHDAY: 'Aniversario proximo',
  INACTIVE_120: 'Inativo 120+ dias',
  INACTIVE_60: 'Inativo 60+ dias',
  FREQUENT: 'Cliente frequente',
  ACTIVE: 'Cliente ativo'
};

export function filterRetentionClients(clients = [], segment = 'ALL', query = '') {
  const normalized = query.trim().toLowerCase();
  return clients.filter((client) => {
    const segmentMatch = segment === 'ALL'
      || (segment === 'OPT_OUT' ? !client.marketingAllowed : client.tags?.includes(segment));
    if (!segmentMatch) return false;
    if (!normalized) return true;
    return `${client.name || ''} ${client.phone || ''} ${client.email || ''} ${client.reason || ''}`
      .toLowerCase()
      .includes(normalized);
  });
}

export function retentionPriorityClass(segment) {
  if (segment === 'BIRTHDAY') return 'birthday';
  if (segment === 'INACTIVE_120') return 'critical';
  if (segment === 'INACTIVE_60') return 'warning';
  if (segment === 'FREQUENT') return 'loyal';
  return 'active';
}

export function formatVisitRecency(client) {
  if (client.daysSinceLastVisit === null || client.daysSinceLastVisit === undefined) return 'Sem atendimento registrado';
  if (client.daysSinceLastVisit === 0) return 'Atendido hoje';
  return `Ultimo atendimento ha ${client.daysSinceLastVisit} dia(s)`;
}

export function buildRetentionKpis(summary = {}) {
  return [
    { label: 'Clientes', value: Number(summary.totalClients || 0), hint: 'Base do CRM' },
    { label: 'Elegiveis', value: Number(summary.eligibleClients || 0), hint: 'Comunicacao permitida' },
    { label: 'Aniversarios', value: Number(summary.birthdays14d || 0), hint: 'Proximos 14 dias' },
    { label: 'Inativos', value: Number(summary.inactive60d || 0), hint: '60 dias ou mais' },
    { label: 'Frequentes', value: Number(summary.frequent90d || 0), hint: '3+ visitas em 90 dias' },
    { label: 'Reativacao', value: `${Number(summary.reactivationRate || 0).toLocaleString('pt-BR')}%`, hint: `${Number(summary.reactivated30d || 0)} retorno(s) apos follow-up` }
  ];
}
