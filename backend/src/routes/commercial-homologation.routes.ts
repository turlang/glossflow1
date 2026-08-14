import { FastifyInstance, FastifyRequest } from 'fastify';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { getModuleReadinessCatalog } from '../services/module-readiness.service';
import { getTenant } from './helpers';

type ValidationModule =
  | 'WHATSAPP'
  | 'POS'
  | 'PACOTES'
  | 'COMPRAS'
  | 'EQUIPE'
  | 'CLINICO'
  | 'PORTAL_CLIENTE'
  | 'RECURSOS';

type CommercialValidationContract = {
  module: ValidationModule;
  automaticProbes: string[];
  manualEvidence: string[];
  promotionBlockers: string[];
};

const COMMERCIAL_VALIDATION_CONTRACTS: CommercialValidationContract[] = [
  {
    module: 'WHATSAPP',
    automaticProbes: ['/admin/homologation/validation-suite'],
    manualEvidence: [
      'Confirmar sender/provider definitivo autorizado para o tenant.',
      'Validar inbound e outbound em ambiente autorizado.',
      'Validar template aprovado e regra de janela de atendimento.'
    ],
    promotionBlockers: ['Twilio Trial/sandbox não pode ser promovido como sender comercial definitivo.']
  },
  {
    module: 'POS',
    automaticProbes: ['/admin/homologation/transactional', '/admin/homologation/checkout-flow'],
    manualEvidence: [
      'Validar venda com pagamento real/sandbox autorizado.',
      'Validar baixa de estoque e lançamento financeiro.',
      'Validar estorno e idempotência do checkout.'
    ],
    promotionBlockers: ['Sem evidência do fluxo completo em tenant QA, manter VALIDATION_REQUIRED.']
  },
  {
    module: 'PACOTES',
    automaticProbes: ['/admin/homologation/transactional', '/admin/homologation/checkout-flow'],
    manualEvidence: [
      'Validar elegibilidade do benefício.',
      'Validar consumo automático de crédito no checkout.',
      'Validar validade e saldo remanescente.'
    ],
    promotionBlockers: ['Sem evidência de consumo correto em QA, manter VALIDATION_REQUIRED.']
  },
  {
    module: 'COMPRAS',
    automaticProbes: ['/admin/homologation/transactional', '/admin/homologation/validation-suite'],
    manualEvidence: [
      'Validar recebimento completo de pedido em QA.',
      'Validar estoque, custo e conta a pagar na mesma operação.',
      'Validar proteção contra recebimento duplicado.'
    ],
    promotionBlockers: ['Recebimento parcial não é representado pelo modelo atual e não deve ser simulado.']
  },
  {
    module: 'EQUIPE',
    automaticProbes: ['/admin/homologation/operations', '/admin/homologation/validation-suite'],
    manualEvidence: [
      'Validar sequência operacional do ponto.',
      'Validar rejeição de transições inválidas.',
      'Validar período e sobreposição da folha operacional.'
    ],
    promotionBlockers: ['Folha legal/fiscal brasileira permanece fora do escopo do módulo operacional.']
  },
  {
    module: 'CLINICO',
    automaticProbes: ['/admin/homologation/operations', '/admin/homologation/validation-suite'],
    manualEvidence: [
      'Validar jornada de prontuário e vínculo com atendimento/cliente.',
      'Validar consentimento completo e UX por usuário autorizado.',
      'Validar auditoria, privacidade e comportamento LGPD.'
    ],
    promotionBlockers: ['Promoção exige homologação humana dedicada de segurança, UX e LGPD.']
  },
  {
    module: 'PORTAL_CLIENTE',
    automaticProbes: ['/admin/homologation/operations', '/admin/homologation/validation-suite'],
    manualEvidence: [
      'Validar criação e rotação do link ativo.',
      'Validar expiração e revogação.',
      'Validar jornada mobile self-service sem exposição cross-tenant.'
    ],
    promotionBlockers: ['Sem jornada self-service homologada em QA, manter VALIDATION_REQUIRED.']
  },
  {
    module: 'RECURSOS',
    automaticProbes: ['/admin/homologation/operations', '/admin/homologation/checkout-flow'],
    manualEvidence: [
      'Validar capacidade e conflito de reserva.',
      'Validar vínculo Agenda → recurso → atendimento.',
      'Validar liberação do recurso após checkout.'
    ],
    promotionBlockers: ['Sem ciclo integrado homologado em QA, manter VALIDATION_REQUIRED.']
  }
];

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function requireAdmin(request: FastifyRequest) {
  const tenant = getTenant(request);
  if (tenant.role !== 'ADMIN') throw httpError(403, 'Esta operação exige o papel ADMIN.');
  return tenant;
}

/**
 * Marco 36 — Etapa 2.
 * Contrato read-only para conduzir homologação comercial dos oito módulos que
 * continuam VALIDATION_REQUIRED. O endpoint não executa mutações, não dispara
 * mensagens e não promove maturidade automaticamente.
 */
export async function commercialHomologationRoutes(app: FastifyInstance) {
  app.get('/admin/homologation/commercial', async (request) => {
    const current = requireAdmin(request);
    const readiness = new Map(getModuleReadinessCatalog().map((item) => [item.key, item]));
    const whatsapp = getIntegrationStatus().find((item) => item.key === 'whatsapp');
    const trialMode = process.env.TWILIO_TRIAL_MODE === 'true';

    const modules = COMMERCIAL_VALIDATION_CONTRACTS.map((contract) => {
      const moduleReadiness = readiness.get(contract.module);
      return {
        ...contract,
        readiness: moduleReadiness
          ? {
              status: moduleReadiness.status,
              maturity: moduleReadiness.maturity,
              nextAction: moduleReadiness.nextAction
            }
          : null,
        providerEvidence:
          contract.module === 'WHATSAPP'
            ? {
                status: whatsapp?.status || 'not_configured',
                missingEnv: whatsapp?.missingEnv || [],
                trialMode,
                definitiveSenderValidated: whatsapp?.status === 'connected' && !trialMode
              }
            : null
      };
    });

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      scope: { salonId: current.salonId, role: current.role },
      policy: {
        readOnly: true,
        requiresQaEvidence: true,
        automaticPromotion: false,
        productionDataMutationAllowed: false
      },
      summary: {
        total: modules.length,
        validationRequired: modules.filter((item) => item.readiness?.status === 'VALIDATION_REQUIRED').length,
        ready: modules.filter((item) => item.readiness?.status === 'READY').length
      },
      modules
    };
  });
}
