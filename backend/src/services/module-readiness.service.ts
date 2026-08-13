import { MODULE_LABELS, SALON_MODULES, SalonModule } from './module-access.service';

export type ModuleReadinessStatus = 'READY' | 'VALIDATION_REQUIRED' | 'EVOLUTION_REQUIRED';

export type ModuleReadiness = {
  status: ModuleReadinessStatus;
  maturity: number;
  summary: string;
  nextAction: string;
};

const MODULE_READINESS: Record<SalonModule, ModuleReadiness> = {
  SITE: { status: 'READY', maturity: 95, summary: 'Vitrine pública, marca e white-label consolidados.', nextAction: 'Manter regressão visual e configuração por tenant.' },
  AGENDA: { status: 'READY', maturity: 95, summary: 'Agenda pública e operacional, conflitos, Smart Fit e lista de espera consolidados.', nextAction: 'Evoluções futuras são premium/UX, não bloqueadoras.' },
  ESTOQUE: { status: 'READY', maturity: 93, summary: 'Movimentação, histórico, mínimo, ruptura, reposição e integração com compras/PDV.', nextAction: 'Manter testes de saldo e integração transacional.' },
  CRM: { status: 'READY', maturity: 92, summary: 'Cadastro, histórico, segmentação, retenção, consentimento e LGPD.', nextAction: 'Manter isolamento por tenant e evolução de segmentações.' },
  FINANCEIRO: { status: 'READY', maturity: 90, summary: 'Receitas, despesas, comissões e lançamentos operacionais integrados.', nextAction: 'Usar Financeiro Avançado para conciliação, caixa e fiscal.' },
  FIDELIDADE: { status: 'READY', maturity: 90, summary: 'Programa, pontos e histórico de fidelidade operacionais.', nextAction: 'Integrar benefícios adicionais ao checkout quando aplicável.' },
  WHATSAPP: { status: 'VALIDATION_REQUIRED', maturity: 85, summary: 'Contratos, templates, lembretes, webhook, agente e guards implementados.', nextAction: 'Homologar provider/sender definitivo do tenant em sandbox autorizado.' },
  IA: { status: 'READY', maturity: 92, summary: 'Base factual, providers, guards, handoff e inteligência comercial implementados.', nextAction: 'Aprimorar qualidade e automações sem reabrir arquitetura central.' },
  ANALYTICS: { status: 'READY', maturity: 90, summary: 'Métricas, crescimento e inteligência de negócio disponíveis.', nextAction: 'Expandir indicadores conforme novas operações gerarem histórico real.' },
  POS: { status: 'VALIDATION_REQUIRED', maturity: 85, summary: 'Checkout, múltiplos pagamentos, estoque, financeiro e estorno implementados.', nextAction: 'Homologar o ciclo atendimento → venda → estoque → financeiro → fechamento.' },
  PACOTES: { status: 'VALIDATION_REQUIRED', maturity: 82, summary: 'Pacotes, memberships e gift cards com saldo/créditos e validade implementados.', nextAction: 'Homologar uso real e integrar consumo automático de benefícios ao checkout/agendamento.' },
  COMPRAS: { status: 'VALIDATION_REQUIRED', maturity: 85, summary: 'Fornecedores, pedidos, recebimento e atualização de estoque implementados.', nextAction: 'Homologar recebimento parcial/total e consistência de custo/estoque em QA.' },
  EQUIPE: { status: 'VALIDATION_REQUIRED', maturity: 82, summary: 'Ponto, metas e fechamento operacional de folha implementados.', nextAction: 'Homologar regras de negócio; folha legal/fiscal brasileira permanece fora do escopo atual.' },
  CLINICO: { status: 'VALIDATION_REQUIRED', maturity: 82, summary: 'Anamnese, evolução, consentimento, alergias e prontuário tenant-safe implementados.', nextAction: 'Executar homologação dedicada de segurança, UX, auditoria e LGPD.' },
  MARKETING: { status: 'EVOLUTION_REQUIRED', maturity: 78, summary: 'Campanhas, cupons, avaliações e preparação de audiência com consentimento LGPD implementados.', nextAction: 'Integrar worker/provider de entrega, scheduler real, gatilhos automáticos e métricas de conversão antes de promover para validação final.' },
  PORTAL_CLIENTE: { status: 'VALIDATION_REQUIRED', maturity: 82, summary: 'Portal temporário seguro com token somente em hash e dados do próprio cliente.', nextAction: 'Homologar jornada completa e polir experiência self-service.' },
  MULTIUNIDADE: { status: 'EVOLUTION_REQUIRED', maturity: 78, summary: 'Convite/aceite, consulta de rede, saída e revogação explícitas entre tenants estão implementados sem compartilhar dados operacionais.', nextAction: 'Definir políticas corporativas e dashboards consolidados antes de qualquer compartilhamento explícito de CRM, estoque ou financeiro.' },
  RECURSOS: { status: 'VALIDATION_REQUIRED', maturity: 82, summary: 'Salas, cadeiras, macas, equipamentos, capacidade e reservas implementados.', nextAction: 'Homologar conflitos e integrar seleção automática de recursos à Agenda.' },
  FINANCEIRO_ADV: { status: 'EVOLUTION_REQUIRED', maturity: 82, summary: 'Caixa, centros de custo, contas, liquidação, conciliação, sincronização de compras e evidência fiscal estão implementados.', nextAction: 'Integrar e homologar provider fiscal/NFS-e real; emissão legal continua dependente do provedor externo.' }
};

export function getModuleReadinessCatalog() {
  return SALON_MODULES.map((key) => ({ key, label: MODULE_LABELS[key], ...MODULE_READINESS[key] }));
}

export function getModuleReadinessSummary() {
  const catalog = getModuleReadinessCatalog();
  return {
    total: catalog.length,
    ready: catalog.filter((module) => module.status === 'READY').length,
    validationRequired: catalog.filter((module) => module.status === 'VALIDATION_REQUIRED').length,
    evolutionRequired: catalog.filter((module) => module.status === 'EVOLUTION_REQUIRED').length
  };
}
