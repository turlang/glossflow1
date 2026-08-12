import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '../utils/auth.js';
import { loadTenantBackofficeData } from './backoffice-data.js';
import { request } from './api.js';

vi.mock('./api.js', () => ({ request: vi.fn() }));

const salon = {
  id: 'salon-1',
  name: 'GlossFlow Teste',
  modulesConfigured: true,
  enabledModules: ['AGENDA', 'ESTOQUE', 'CRM', 'FINANCEIRO', 'FIDELIDADE', 'WHATSAPP', 'IA']
};

function responseFor(path) {
  if (path === '/admin/salon-info') return salon;
  if (path === '/admin/commissions') return { rules: [], projections: [] };
  if (path === '/admin/loyalty') return { program: null, entries: [] };
  if (path === '/admin/subscription') return { plans: [], subscription: null };
  if (path === '/admin/insights') return { saved: [], suggestions: [] };
  return [];
}

function calledPaths() {
  return request.mock.calls.map(([path]) => path);
}

describe('loadTenantBackofficeData por papel', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(async (path) => responseFor(path));
  });

  it('ADMIN carrega todos os domínios autorizados', async () => {
    await loadTenantBackofficeData({ role: ROLES.ADMIN });
    const paths = calledPaths();
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/admin/financial');
    expect(paths).toContain('/admin/commissions');
    expect(paths).toContain('/admin/subscription');
    expect(paths).toContain('/admin/clients');
    expect(paths).toContain('/admin/inventory');
  });

  it('RECEPTION não consulta endpoints exclusivos do ADMIN', async () => {
    await loadTenantBackofficeData({ role: ROLES.RECEPTION });
    const paths = calledPaths();
    expect(paths).toContain('/admin/appointments');
    expect(paths).toContain('/admin/inventory');
    expect(paths).toContain('/admin/clients');
    expect(paths).toContain('/admin/loyalty');
    expect(paths).toContain('/admin/whatsapp/templates');
    expect(paths).toContain('/admin/insights');
    expect(paths).not.toContain('/admin/users');
    expect(paths).not.toContain('/admin/financial');
    expect(paths).not.toContain('/admin/commissions');
    expect(paths).not.toContain('/admin/subscription');
  });

  it('PROFESSIONAL consulta apenas salão e Agenda', async () => {
    await loadTenantBackofficeData({ role: ROLES.PROFESSIONAL });
    expect(calledPaths()).toEqual(['/admin/salon-info', '/admin/appointments']);
  });
});
