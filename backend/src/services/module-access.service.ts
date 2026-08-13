import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from '../routes/helpers';

export const SALON_MODULES = [
  'SITE','AGENDA','ESTOQUE','CRM','FINANCEIRO','FIDELIDADE','WHATSAPP','IA','ANALYTICS',
  'POS','PACOTES','COMPRAS','EQUIPE','CLINICO','MARKETING','PORTAL_CLIENTE','MULTIUNIDADE','RECURSOS','FINANCEIRO_ADV'
] as const;

export type SalonModule = typeof SALON_MODULES[number];

export const MODULE_LABELS: Record<SalonModule, string> = {
  SITE: 'Site & Marca', AGENDA: 'Agenda', ESTOQUE: 'Estoque', CRM: 'Clientes / CRM', FINANCEIRO: 'Financeiro',
  FIDELIDADE: 'Fidelidade', WHATSAPP: 'WhatsApp', IA: 'Inteligência Artificial', ANALYTICS: 'Métricas Avançadas',
  POS: 'PDV / Checkout', PACOTES: 'Pacotes e Assinaturas de Clientes', COMPRAS: 'Compras e Fornecedores',
  EQUIPE: 'Equipe, Ponto e Folha', CLINICO: 'Anamnese / Prontuário', MARKETING: 'Marketing e Reputação',
  PORTAL_CLIENTE: 'Portal do Cliente', MULTIUNIDADE: 'Multiunidade / Redes', RECURSOS: 'Recursos Físicos',
  FINANCEIRO_ADV: 'Financeiro Avançado / Fiscal'
};

export const DEFAULT_ENABLED_MODULES: SalonModule[] = [...SALON_MODULES];
export function normalizeEnabledModules(salon: { modulesConfigured?: boolean | null; enabledModules?: string[] | null }) { if (!salon?.modulesConfigured) return [...DEFAULT_ENABLED_MODULES]; const allowed = new Set<string>(SALON_MODULES); return (salon.enabledModules || []).filter((item): item is SalonModule => allowed.has(item)); }
export function hasSalonModule(salon: { modulesConfigured?: boolean | null; enabledModules?: string[] | null }, module: SalonModule) { return normalizeEnabledModules(salon).includes(module); }
export function moduleForAdminPath(url: string): SalonModule | null {
  const path = url.split('?')[0];
  if (path.startsWith('/admin/appointments')) return 'AGENDA';
  if (path.startsWith('/admin/inventory')) return 'ESTOQUE';
  if (path.startsWith('/admin/clients')) return 'CRM';
  if (path.startsWith('/admin/financial') || path.startsWith('/admin/commissions')) return 'FINANCEIRO';
  if (path.startsWith('/admin/loyalty')) return 'FIDELIDADE';
  if (path.startsWith('/admin/whatsapp')) return 'WHATSAPP';
  if (path.startsWith('/admin/ai') || path.startsWith('/admin/insights')) return 'IA';
  if (path.startsWith('/admin/analytics') || path.startsWith('/admin/growth')) return 'ANALYTICS';
  if (path === '/admin/salon' || path.startsWith('/admin/site')) return 'SITE';
  if (path.startsWith('/admin/pos')) return 'POS';
  if (path.startsWith('/admin/customer-plans')) return 'PACOTES';
  if (path.startsWith('/admin/procurement')) return 'COMPRAS';
  if (path.startsWith('/admin/team-management')) return 'EQUIPE';
  if (path.startsWith('/admin/clinical-records')) return 'CLINICO';
  if (path.startsWith('/admin/marketing')) return 'MARKETING';
  if (path.startsWith('/admin/client-portal')) return 'PORTAL_CLIENTE';
  if (path.startsWith('/admin/organizations')) return 'MULTIUNIDADE';
  if (path.startsWith('/admin/resources')) return 'RECURSOS';
  if (path.startsWith('/admin/finance-advanced')) return 'FINANCEIRO_ADV';
  return null;
}

export async function enforceSalonModuleAccess(request: FastifyRequest, reply: FastifyReply) {
  const module = moduleForAdminPath(request.url); if (!module) return;
  const tenant = getTenant(request);
  const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { modulesConfigured: true, enabledModules: true } });
  if (!salon) return reply.status(404).send({ message: 'Salão da sessão não encontrado.' });
  if (!hasSalonModule(salon, module)) return reply.status(403).send({ message: `Módulo ${MODULE_LABELS[module]} não habilitado para este salão.`, code: 'MODULE_DISABLED', module });
}
