export const MODULE_CATALOG = [
  { key: 'SITE', label: 'Site & Marca', description: 'Vitrine, identidade visual e domínio próprio.' },
  { key: 'AGENDA', label: 'Agenda', description: 'Agendamentos, disponibilidade e calendário.' },
  { key: 'ESTOQUE', label: 'Estoque', description: 'Produtos, movimentações e alertas de reposição.' },
  { key: 'CRM', label: 'Clientes / CRM', description: 'Cadastro, histórico e relacionamento com clientes.' },
  { key: 'FINANCEIRO', label: 'Financeiro', description: 'Receitas, despesas e comissões.' },
  { key: 'FIDELIDADE', label: 'Fidelidade', description: 'Pontos, recompensas e benefícios.' },
  { key: 'WHATSAPP', label: 'WhatsApp', description: 'Automações, templates e atendimento pelo WhatsApp.' },
  { key: 'IA', label: 'Inteligência Artificial', description: 'Assistente, insights e agente inteligente.' },
  { key: 'ANALYTICS', label: 'Métricas Avançadas', description: 'LTV, churn, ocupação e previsões.' }
];

export const DEFAULT_ENABLED_MODULES = MODULE_CATALOG.map((item) => item.key);

export function enabledModulesFor(salon) {
  if (!salon?.modulesConfigured) return [...DEFAULT_ENABLED_MODULES];
  const allowed = new Set(DEFAULT_ENABLED_MODULES);
  return (salon.enabledModules || []).filter((item) => allowed.has(item));
}

export function hasModule(salon, moduleKey) {
  return enabledModulesFor(salon).includes(moduleKey);
}
