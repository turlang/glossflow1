import { request } from './api';
import { hasModule } from '../utils/modules';
import { canUseBusinessBackoffice, isSalonAdmin } from '../utils/auth';

/**
 * Estado vazio canônico do backoffice.
 * Mantê-lo em um único lugar evita pequenas diferenças entre logout, troca de
 * tenant, Super Admin e sessão sem acesso a determinado módulo.
 */
export function emptyBackofficeData() {
  return {
    adminSalon: null,
    appointments: [],
    inventory: [],
    users: [],
    clients: [],
    financialEntries: [],
    commissions: { rules: [], projections: [] },
    loyalty: { program: null, entries: [] },
    subscription: { plans: [], subscription: null },
    whatsappTemplates: [],
    insights: { saved: [], suggestions: [] }
  };
}

/**
 * Carrega somente endpoints que o papel autenticado pode consultar.
 *
 * Antes desta separação, um RECEPTION/PROFESSIONAL podia receber 403 em um
 * endpoint restrito (como `/admin/users`) e o App interpretava isso como sessão
 * inválida. Autorização continua no backend; aqui apenas evitamos requisições
 * sabidamente proibidas e tornamos a experiência mais resiliente.
 */
export async function loadTenantBackofficeData({ role }) {
  const adminSalon = await request('/admin/salon-info');
  const admin = isSalonAdmin(role);
  const businessAccess = canUseBusinessBackoffice(role);

  const agendaEnabled = hasModule(adminSalon, 'AGENDA');
  const inventoryEnabled = hasModule(adminSalon, 'ESTOQUE');
  const crmEnabled = hasModule(adminSalon, 'CRM');
  const financialEnabled = hasModule(adminSalon, 'FINANCEIRO');
  const loyaltyEnabled = hasModule(adminSalon, 'FIDELIDADE');
  const whatsappEnabled = hasModule(adminSalon, 'WHATSAPP');
  const aiEnabled = hasModule(adminSalon, 'IA');

  const [
    appointments,
    inventory,
    users,
    clients,
    financialEntries,
    commissions,
    loyalty,
    subscription,
    whatsappTemplates,
    insights
  ] = await Promise.all([
    agendaEnabled ? request('/admin/appointments') : Promise.resolve([]),
    businessAccess && inventoryEnabled ? request('/admin/inventory') : Promise.resolve([]),
    admin ? request('/admin/users') : Promise.resolve([]),
    businessAccess && crmEnabled ? request('/admin/clients') : Promise.resolve([]),
    admin && financialEnabled ? request('/admin/financial') : Promise.resolve([]),
    admin && financialEnabled ? request('/admin/commissions') : Promise.resolve({ rules: [], projections: [] }),
    businessAccess && loyaltyEnabled ? request('/admin/loyalty') : Promise.resolve({ program: null, entries: [] }),
    admin ? request('/admin/subscription') : Promise.resolve({ plans: [], subscription: null }),
    businessAccess && whatsappEnabled ? request('/admin/whatsapp/templates') : Promise.resolve([]),
    businessAccess && aiEnabled ? request('/admin/insights') : Promise.resolve({ saved: [], suggestions: [] })
  ]);

  return {
    adminSalon,
    appointments,
    inventory,
    users,
    clients,
    financialEntries,
    commissions,
    loyalty,
    subscription,
    whatsappTemplates,
    insights
  };
}
