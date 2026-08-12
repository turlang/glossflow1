import React, { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaasProvisioningWizard } from './SaasProvisioningWizard.jsx';

const modules = [
  { key: 'SITE', label: 'Site & Marca', description: 'Vitrine pública' },
  { key: 'AGENDA', label: 'Agenda', description: 'Agenda comercial' },
  { key: 'CRM', label: 'CRM', description: 'Relacionamento' }
];

const plans = [
  { id: '507f1f77bcf86cd799439012', name: 'Smart', price: 199, active: true },
  { id: '507f1f77bcf86cd799439013', name: 'Arquivado', price: 99, active: false }
];

const valid = {
  name: 'Studio Aurora',
  slug: 'studio-aurora',
  phone: '11999999999',
  whatsapp: '11999999999',
  address: 'Rua Aurora, 21',
  openingHours: '09h às 19h',
  description: 'Salão de homologação',
  instagram: '',
  adminName: 'Ana Admin',
  adminEmail: 'ana@aurora.test',
  adminPassword: 'SenhaSegura123!',
  planId: plans[0].id,
  subscriptionStatus: 'TRIAL',
  subscriptionEndsAt: '',
  billingProvider: 'MANUAL',
  enabledModules: ['SITE', 'AGENDA']
};

function Harness({ initial = valid, onSubmit = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return (
    <SaasProvisioningWizard
      value={value}
      setValue={setValue}
      modules={modules}
      plans={plans}
      saving={false}
      onSubmit={(event) => { event.preventDefault(); onSubmit(value); }}
    />
  );
}

afterEach(() => cleanup());

describe('SaasProvisioningWizard', () => {
  it('organiza o provisionamento em cinco etapas comerciais', () => {
    render(<Harness />);
    expect(screen.getByText('Provisionar salão completo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /01 Salão/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /03 Contrato/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /05 Revisão/i })).toBeTruthy();
  });

  it('não permite avançar do contrato sem plano ativo selecionado', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...valid, planId: '' }} />);

    await user.click(screen.getByRole('button', { name: 'Continuar →' }));
    await user.click(screen.getByRole('button', { name: 'Continuar →' }));

    expect(screen.getByRole('heading', { name: 'Plano e ciclo de vida' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar →' }).disabled).toBe(true);
    expect(screen.queryByRole('option', { name: /Arquivado/ })).toBeNull();
  });

  it('exige ao menos um módulo contratado antes da revisão', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...valid, enabledModules: [] }} />);

    await user.click(screen.getByRole('button', { name: /04 Módulos/i }));
    expect(screen.getByText('Selecione ao menos um módulo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar →' }).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /Site & Marca/i }));
    expect(screen.getByRole('button', { name: 'Continuar →' }).disabled).toBe(false);
  });

  it('submete somente depois da revisão com plano, ADMIN e módulos definidos', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<Harness onSubmit={submit} />);

    await user.click(screen.getByRole('button', { name: /05 Revisão/i }));
    expect(screen.getByText('Revisar e provisionar')).toBeTruthy();
    expect(screen.getByText('Studio Aurora')).toBeTruthy();
    expect(screen.getByText('Smart')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Provisionar cliente SaaS' }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0].subscriptionStatus).toBe('TRIAL');
    expect(submit.mock.calls[0][0].enabledModules).toEqual(['SITE', 'AGENDA']);
  });
});
