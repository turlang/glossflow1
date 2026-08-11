/**
 * Utilitários puros de autenticação/autorização do frontend.
 *
 * O frontend usa o papel do JWT somente para decidir o que renderizar ou quais
 * recursos vale a pena buscar. A autorização real continua obrigatoriamente no
 * backend; nenhuma função deste arquivo substitui RBAC do servidor.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  RECEPTION: 'RECEPTION',
  PROFESSIONAL: 'PROFESSIONAL'
});

/**
 * Extrai apenas o campo `role` do JWT sem validar assinatura.
 * Isso é suficiente para UX, porque qualquer decisão de segurança é repetida
 * e validada pelo backend com o token assinado.
 */
export function tokenRole(token) {
  if (!token) return '';

  try {
    const payload = token.split('.')[1];
    if (!payload) return '';

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded))?.role || '';
  } catch {
    return '';
  }
}

export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function isSalonAdmin(role) {
  return role === ROLES.ADMIN;
}

export function isReception(role) {
  return role === ROLES.RECEPTION;
}

export function isProfessional(role) {
  return role === ROLES.PROFESSIONAL;
}

/** ADMIN e RECEPTION compartilham a maior parte da operação comercial. */
export function canUseBusinessBackoffice(role) {
  return isSalonAdmin(role) || isReception(role);
}
