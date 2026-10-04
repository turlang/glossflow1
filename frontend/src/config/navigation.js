import { isSuperAdmin } from '../utils/auth';
import { canAccessTenantPage } from './role-access.js';
import { essentialHomeForRole } from './essential-experience.js';

export const TENANT_BACKOFFICE_PAGES = Object.freeze([
  'admin', 'professional-today', 'agent-test', 'professional-services', 'professional-schedule',
  'operational-agenda', 'smart-fit', 'waitlist'
]);

const TENANT_ACTIONS = new Set(TENANT_BACKOFFICE_PAGES.filter((page) => page !== 'admin' && page !== 'professional-today'));

export function resolveInitialPage({ action, authenticated, role }) {
  if (action === 'booking') return 'booking';
  if (action === 'commercial') return 'commercial';
  if (action === 'client-portal') return 'client-portal';
  if (action === 'platform-admin') return authenticated && isSuperAdmin(role) ? 'platform-admin' : 'login';

  if (action === 'admin' || action === 'site-settings' || action === 'professional-today') {
    if (!authenticated) return 'login';
    if (isSuperAdmin(role)) return 'platform-admin';
    return essentialHomeForRole(role);
  }

  if (TENANT_ACTIONS.has(action)) {
    return authenticated && !isSuperAdmin(role) && canAccessTenantPage(role, action) ? action : 'login';
  }

  return 'public';
}

export function normalizePageForRole({ page, authenticated, role }) {
  const protectedPage = page === 'platform-admin' || TENANT_BACKOFFICE_PAGES.includes(page);
  if (!authenticated && protectedPage) return 'login';
  if (authenticated && isSuperAdmin(role) && TENANT_BACKOFFICE_PAGES.includes(page)) return 'platform-admin';
  if (authenticated && !isSuperAdmin(role) && page === 'platform-admin') return essentialHomeForRole(role);
  if (authenticated && !isSuperAdmin(role) && page === 'admin' && essentialHomeForRole(role) === 'professional-today') return 'professional-today';
  if (authenticated && !isSuperAdmin(role) && TENANT_BACKOFFICE_PAGES.includes(page) && !canAccessTenantPage(role, page)) return essentialHomeForRole(role);
  return page;
}
