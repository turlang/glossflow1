export const MODULE_CATALOG = [
  { key: 'SITE', label: 'Site & Marca', description: 'Vitrine, identidade visual e domínio próprio.' },
  { key: 'AGENDA', label: 'Agenda', description: 'Agendamentos, disponibilidade e calendário.' },
  { key: 'ESTOQUE', label: 'Estoque', description: 'Produtos, movimentações e alertas de reposição.' },
  { key: 'CRM', label: 'Clientes / CRM', description: 'Cadastro, histórico e relacionamento com clientes.' },
  { key: 'FINANCEIRO', label: 'Financeiro', description: 'Receitas, despesas e comissões.' },
  { key: 'FIDELIDADE', label: 'Fidelidade', description: 'Pontos, recompensas e benefícios.' },
  { key: 'WHATSAPP', label: 'WhatsApp', description: 'Automações, templates e atendimento pelo WhatsApp.' },
  { key: 'IA', label: 'Inteligência Artificial', description: 'Assistente, insights e agente inteligente.' },
  { key: 'ANALYTICS', label: 'Métricas Avançadas', description: 'LTV, churn, ocupação e previsões.' },

  { key: 'POS', label: 'PDV / Checkout', description: 'Venda de serviços e produtos, pagamentos e estorno.' },
  { key: 'PACOTES', label: 'Pacotes & Assinaturas', description: 'Pacotes, memberships, créditos e gift cards.' },
  { key: 'COMPRAS', label: 'Compras & Fornecedores', description: 'Pedidos de compra, recebimento e reposição.' },
  { key: 'EQUIPE', label: 'Equipe & Folha', description: 'Ponto, metas, comissão e fechamento de folha.' },
  { key: 'CLINICO', label: 'Anamnese / Prontuário', description: 'Fichas, consentimentos e histórico estético.' },
  { key: 'MARKETING', label: 'Marketing 360', description: 'Campanhas, reputação, avaliações e cupons.' },
  { key: 'PORTAL_CLIENTE', label: 'Portal do Cliente', description: 'Acesso seguro ao histórico, agenda e benefícios.' },
  { key: 'MULTIUNIDADE', label: 'Multiunidade', description: 'Redes, unidades e visão corporativa.' },
  { key: 'RECURSOS', label: 'Recursos Físicos', description: 'Salas, cadeiras, macas e equipamentos.' },
  { key: 'FINANCEIRO_ADV', label: 'Financeiro Avançado', description: 'Caixa, contas, conciliação e fiscal.' }
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
