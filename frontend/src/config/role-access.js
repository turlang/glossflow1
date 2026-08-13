import { ROLES } from '../utils/auth.js';

/**
 * Matriz canônica de UX por papel.
 * A autorização real permanece no backend; esta matriz impede que a interface
 * ofereça ações que o servidor rejeitará por RBAC.
 */
export const DASHBOARD_MENU_KEYS_BY_ROLE = Object.freeze({
  [ROLES.ADMIN]: Object.freeze([
    'executive', 'onboarding', 'analytics', 'services', 'professionals', 'portfolio',
    'appointments', 'inventory', 'users', 'clients', 'financial', 'commissions',
    'loyalty', 'subscription', 'automations', 'assistant', 'security', 'ecosystem',
    'observability', 'ux', 'pwa',
    'pos', 'customer-plans', 'procurement', 'team-management', 'clinical',
    'marketing', 'client-portal', 'organizations', 'resources', 'finance-advanced'
  ]),
  [ROLES.RECEPTION]: Object.freeze([
    'executive', 'onboarding', 'services', 'professionals', 'portfolio', 'appointments',
    'inventory', 'clients', 'loyalty', 'automations', 'assistant', 'ux', 'pwa',
    'pos', 'customer-plans', 'procurement', 'team-management',
    'marketing', 'client-portal', 'resources'
  ]),
  [ROLES.PROFESSIONAL]: Object.freeze(['executive', 'appointments', 'ux', 'pwa'])
});

const TENANT_PAGE_ROLES = Object.freeze({
  admin: Object.freeze([ROLES.ADMIN, ROLES.RECEPTION, ROLES.PROFESSIONAL]),
  'agent-test': Object.freeze([ROLES.ADMIN, ROLES.RECEPTION]),
  'professional-services': Object.freeze([ROLES.ADMIN, ROLES.RECEPTION]),
  'professional-schedule': Object.freeze([ROLES.ADMIN, ROLES.RECEPTION]),
  'operational-agenda': Object.freeze([ROLES.ADMIN, ROLES.RECEPTION]),
  'smart-fit': Object.freeze([ROLES.ADMIN, ROLES.RECEPTION, ROLES.PROFESSIONAL]),
  waitlist: Object.freeze([ROLES.ADMIN, ROLES.RECEPTION])
});

export function dashboardMenuForRole(role, menu) {
  const allowed = new Set(DASHBOARD_MENU_KEYS_BY_ROLE[role] || []);
  return menu.filter((item) => allowed.has(item.key));
}

export function canAccessTenantPage(role, page) {
  return Boolean(TENANT_PAGE_ROLES[page]?.includes(role));
}

export function defaultDashboardTabForRole(role) {
  return DASHBOARD_MENU_KEYS_BY_ROLE[role]?.[0] || 'executive';
}
