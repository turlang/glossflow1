import { describe, expect, it } from 'vitest';
import { MODULE_CATALOG } from '../utils/modules.js';
import { dashboardMenuForRole } from './role-access.js';
import { resolveInitialPage } from './navigation.js';
import { ROLES } from '../utils/auth.js';

const expansionKeys = [
  'pos', 'customer-plans', 'procurement', 'team-management', 'clinical',
  'marketing', 'client-portal', 'organizations', 'resources', 'finance-advanced'
];

const expansionModules = [
  'POS', 'PACOTES', 'COMPRAS', 'EQUIPE', 'CLINICO',
  'MARKETING', 'PORTAL_CLIENTE', 'MULTIUNIDADE', 'RECURSOS', 'FINANCEIRO_ADV'
];

const menu = expansionKeys.map((key) => ({ key, label: key, description: key }));

describe('Marcos 25–34 no frontend', () => {
  it('publica os dez novos entitlements no catálogo visual', () => {
    const keys = MODULE_CATALOG.map((item) => item.key);
    for (const module of expansionModules) expect(keys).toContain(module);
  });

  it('ADMIN visualiza os dez módulos de expansão', () => {
    expect(dashboardMenuForRole(ROLES.ADMIN, menu).map((item) => item.key)).toEqual(expansionKeys);
  });

  it('RECEPTION não recebe clínico, multiunidade ou financeiro avançado', () => {
    const keys = dashboardMenuForRole(ROLES.RECEPTION, menu).map((item) => item.key);
    expect(keys).not.toContain('clinical');
    expect(keys).not.toContain('organizations');
    expect(keys).not.toContain('finance-advanced');
    expect(keys).toContain('pos');
    expect(keys).toContain('client-portal');
  });

  it('PROFESSIONAL não recebe a suite comercial', () => {
    expect(dashboardMenuForRole(ROLES.PROFESSIONAL, menu)).toEqual([]);
  });

  it('portal do cliente permanece público e independente de login', () => {
    expect(resolveInitialPage({ action: 'client-portal', authenticated: false, role: '' })).toBe('client-portal');
  });
});
