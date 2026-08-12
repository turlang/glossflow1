import { describe, expect, it } from 'vitest';
import { ROLES } from '../utils/auth.js';
import { canAccessTenantPage, dashboardMenuForRole } from './role-access.js';
import { normalizePageForRole, resolveInitialPage } from './navigation.js';

const menu = [
  'executive', 'onboarding', 'analytics', 'services', 'professionals', 'portfolio',
  'appointments', 'inventory', 'users', 'clients', 'financial', 'commissions',
  'loyalty', 'subscription', 'automations', 'assistant', 'security', 'ecosystem',
  'observability', 'ux', 'pwa'
].map((key) => ({ key, label: key, description: key }));

describe('matriz de homologação por papel', () => {
  it('ADMIN mantém todos os módulos administrativos', () => {
    expect(dashboardMenuForRole(ROLES.ADMIN, menu).map((item) => item.key)).toEqual(menu.map((item) => item.key));
  });

  it('RECEPTION vê operação comercial sem usuários, financeiro, assinatura ou segurança', () => {
    const keys = dashboardMenuForRole(ROLES.RECEPTION, menu).map((item) => item.key);
    expect(keys).toContain('appointments');
    expect(keys).toContain('inventory');
    expect(keys).toContain('clients');
    expect(keys).toContain('assistant');
    expect(keys).not.toContain('users');
    expect(keys).not.toContain('financial');
    expect(keys).not.toContain('subscription');
    expect(keys).not.toContain('security');
  });

  it('PROFESSIONAL recebe somente dashboard, agenda somente leitura e módulos locais de UX/PWA', () => {
    expect(dashboardMenuForRole(ROLES.PROFESSIONAL, menu).map((item) => item.key)).toEqual([
      'executive', 'appointments', 'ux', 'pwa'
    ]);
  });

  it('PROFESSIONAL não pode abrir telas de gestão por URL direta', () => {
    expect(canAccessTenantPage(ROLES.PROFESSIONAL, 'operational-agenda')).toBe(false);
    expect(canAccessTenantPage(ROLES.PROFESSIONAL, 'waitlist')).toBe(false);
    expect(canAccessTenantPage(ROLES.PROFESSIONAL, 'agent-test')).toBe(false);
    expect(canAccessTenantPage(ROLES.PROFESSIONAL, 'smart-fit')).toBe(true);
  });

  it('URL direta de operação proibida não abre tela para PROFESSIONAL', () => {
    expect(resolveInitialPage({ action: 'operational-agenda', authenticated: true, role: ROLES.PROFESSIONAL })).toBe('login');
    expect(resolveInitialPage({ action: 'waitlist', authenticated: true, role: ROLES.PROFESSIONAL })).toBe('login');
  });

  it('ADMIN e RECEPTION continuam abrindo telas operacionais permitidas', () => {
    expect(resolveInitialPage({ action: 'operational-agenda', authenticated: true, role: ROLES.ADMIN })).toBe('operational-agenda');
    expect(resolveInitialPage({ action: 'agent-test', authenticated: true, role: ROLES.RECEPTION })).toBe('agent-test');
  });

  it('troca de papel redireciona uma tela proibida para o dashboard do tenant', () => {
    expect(normalizePageForRole({ page: 'waitlist', authenticated: true, role: ROLES.PROFESSIONAL })).toBe('admin');
    expect(normalizePageForRole({ page: 'professional-schedule', authenticated: true, role: ROLES.PROFESSIONAL })).toBe('admin');
  });

  it('SUPER_ADMIN nunca permanece no painel operacional de um tenant', () => {
    expect(normalizePageForRole({ page: 'admin', authenticated: true, role: ROLES.SUPER_ADMIN })).toBe('platform-admin');
    expect(resolveInitialPage({ action: 'platform-admin', authenticated: true, role: ROLES.SUPER_ADMIN })).toBe('platform-admin');
  });
});
