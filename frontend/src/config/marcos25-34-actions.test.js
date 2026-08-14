import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const suite = readFileSync(resolve(here, '../components/admin/BusinessExpansionSuite.jsx'), 'utf8');
const actions = readFileSync(resolve(here, '../components/admin/BusinessExpansionActions.jsx'), 'utf8');

describe('Marcos 25–34 — contratos operacionais da UI', () => {
  it('expõe os dez módulos no painel compartilhado', () => {
    for (const key of ['pos', 'customer-plans', 'procurement', 'team-management', 'clinical', 'marketing', 'client-portal', 'organizations', 'resources', 'finance-advanced']) {
      expect(suite).toContain(key);
    }
  });

  it('expõe as ações transacionais críticas dos módulos', () => {
    for (const path of [
      '/admin/pos/sales/',
      '/admin/customer-plans/packages/assign',
      '/admin/customer-plans/memberships',
      '/admin/customer-plans/gift-cards',
      '/admin/procurement/orders',
      '/admin/team-management/goals',
      '/admin/team-management/payroll',
      '/admin/marketing/coupons',
      '/admin/marketing/reviews',
      '/admin/client-portal/access/',
      '/admin/resources/reservations',
      '/admin/finance-advanced/cost-centers',
      '/admin/finance-advanced/cash/open',
      '/admin/finance-advanced/reconciliations',
      '/admin/finance-advanced/fiscal-documents'
    ]) {
      expect(actions).toContain(path);
    }
  });

  it('usa convite e aceite explícito no módulo multiunidade', () => {
    expect(suite).toContain('/admin/organizations/${inviteOrganizationId}/invite');
    expect(suite).toContain('/admin/organizations/join');
    expect(suite).toContain('Vincular unidades com consentimento');
  });

  it('expõe vínculo do atendimento e consentimento clínico completo', () => {
    expect(suite).toContain("['appointmentId', 'Atendimento relacionado', 'appointment']");
    expect(suite).toContain("['consentText', 'Texto do consentimento (obrigatório para CONSENT)', 'textarea']");
    expect(suite).toContain("['signedAt', 'Data e hora da assinatura', 'datetime-local']");
    expect(suite).toContain('appointmentId: normalized.appointmentId || undefined');
    expect(suite).toContain('signedAt: normalized.signedAt || undefined');
    expect(suite).not.toContain("consentText: '' });");
  });
});
