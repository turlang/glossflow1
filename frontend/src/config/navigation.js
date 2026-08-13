import { isSuperAdmin } from '../utils/auth';
import { canAccessTenantPage } from './role-access.js';

/**
 * Páginas que representam operação autenticada do salão.
 * A lista é reutilizada para título, redirecionamento e proteção visual.
 */
export const TENANT_BACKOFFICE_PAGES = Object.freeze([
  'admin',
  'agent-test',
  'professional-services',
  'professional-schedule',
  'operational-agenda',
  'smart-fit',
  'waitlist'
]);

const TENANT_ACTIONS = new Set(TENANT_BACKOFFICE_PAGES.filter((page) => page !== 'admin'));

/**
 * Traduz `?action=` para uma página inicial única.
 * A matriz por papel evita abrir uma tela que o backend rejeitará por RBAC.
 */
export function resolveInitialPage({ action, authenticated, role }) {
  if (action === 'booking') return 'booking';
  if (action === 'commercial') return 'commercial';
  if (action === 'client-portal') return 'client-portal';

  if (action === 'platform-admin') {
    return authenticated && isSuperAdmin(role) ? 'platform-admin' : 'login';
  }

  if (action === 'admin' || action === 'site-settings') {
    if (!authenticated) return 'login';
    if (isSuperAdmin(role)) return 'platform-admin';
    return canAccessTenantPage(role, 'admin') ? 'admin' : 'login';
  }

  if (TENANT_ACTIONS.has(action)) {
    return authenticated && !isSuperAdmin(role) && canAccessTenantPage(role, action)
      ? action
      : 'login';
  }

  return 'public';
}

/** Garante que uma troca de sessão nunca deixe o usuário em painel incompatível. */
export function normalizePageForRole({ page, authenticated, role }) {
  const protectedPage = page === 'platform-admin' || TENANT_BACKOFFICE_PAGES.includes(page);
  if (!authenticated && protectedPage) return 'login';

  if (authenticated && isSuperAdmin(role) && TENANT_BACKOFFICE_PAGES.includes(page)) {
    return 'platform-admin';
  }

  if (authenticated && !isSuperAdmin(role) && page === 'platform-admin') {
    return canAccessTenantPage(role, 'admin') ? 'admin' : 'login';
  }

  if (authenticated && !isSuperAdmin(role) && TENANT_BACKOFFICE_PAGES.includes(page) && !canAccessTenantPage(role, page)) {
    return canAccessTenantPage(role, 'admin') ? 'admin' : 'login';
  }

  return page;
}
