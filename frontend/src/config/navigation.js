import { isSuperAdmin } from '../utils/auth';

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

const TENANT_ACTIONS = new Set([
  'agent-test',
  'professional-services',
  'professional-schedule',
  'operational-agenda',
  'smart-fit',
  'waitlist'
]);

/**
 * Traduz `?action=` para uma página inicial única.
 * Mantemos esse parser fora do App para impedir múltiplos `setPage` encadeados
 * e tornar os redirecionamentos por papel previsíveis.
 */
export function resolveInitialPage({ action, authenticated, role }) {
  if (action === 'booking') return 'booking';
  if (action === 'commercial') return 'commercial';

  if (action === 'platform-admin') {
    return authenticated && isSuperAdmin(role) ? 'platform-admin' : 'login';
  }

  if (action === 'admin' || action === 'site-settings') {
    if (!authenticated) return 'login';
    return isSuperAdmin(role) ? 'platform-admin' : 'admin';
  }

  if (TENANT_ACTIONS.has(action)) {
    return authenticated && !isSuperAdmin(role) ? action : 'login';
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
    return 'admin';
  }

  return page;
}
