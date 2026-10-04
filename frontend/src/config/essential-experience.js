import { ROLES } from '../utils/auth.js';

/**
 * GlossFlow Essential
 *
 * Centraliza a experiência inicial por papel. A autorização continua no backend;
 * este arquivo descreve somente navegação e prioridades de UX.
 */
export const ESSENTIAL_HOME_BY_ROLE = Object.freeze({
  [ROLES.ADMIN]: 'admin',
  [ROLES.RECEPTION]: 'admin',
  [ROLES.PROFESSIONAL]: 'professional-today'
});

export const ESSENTIAL_HOME_LABEL_BY_ROLE = Object.freeze({
  [ROLES.ADMIN]: 'Meu negócio hoje',
  [ROLES.RECEPTION]: 'Operação de hoje',
  [ROLES.PROFESSIONAL]: 'Minha agenda de hoje'
});

export function essentialHomeForRole(role) {
  return ESSENTIAL_HOME_BY_ROLE[role] || 'login';
}

export function essentialHomeLabelForRole(role) {
  return ESSENTIAL_HOME_LABEL_BY_ROLE[role] || 'Início';
}
