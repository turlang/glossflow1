import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaCheckoutPanel } from './AgendaCheckoutPanel.jsx';

const requestMock = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api.js', () => ({ request: requestMock }));

const appointments = [{
  id: '507f1f77bcf86cd799439011',
  clientName: 'Carla',
  startTime: '2026-08-13T14:00:00.000Z',
  endTime: '2026-08-13T15:00:00.000Z',
  status: 'CONFIRMED',
  service: { id: '507f1f77bcf86cd799439012', name: 'Corte Premium', price: 120 }
}];

const preview = {
  appointment: {
    id: appointments[0].id,
    clientName: 'Carla',
    status: 'CONFIRMED',
    service: { id: '507f1f77bcf86cd799439012', name: 'Corte Premium', price: 120 },
    professional: { id: '507f1f77bcf86cd799439013', name: 'Ana' }
  },
  existingSale: null,
  eligiblePackages: [{ id: '507f1f77bcf86cd799439014', name: 'Pacote Essencial', remainingCredits: 2 }],
  resourceReservations: [],
  availableResources: [{ id: '507f1f77bcf86cd799439015', name: 'Cadeira 1', type: 'CHAIR', capacity: 1, available: true }],
  modules: { packages: true, resources: true },
  readyForCheckout: true
};

describe('AgendaCheckoutPanel', () => {
  beforeEach(() => requestMock.mockReset());
  afterEach(() => cleanup());

  it('abre o preview server-side do atendimento antes do fechamento', async () => {
    requestMock.mockResolvedValueOnce(preview);
    const user = userEvent.setup();
    render(<AgendaCheckoutPanel appointments={appointments} reload={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Atendimento'), appointments[0].id);
    await user.click(screen.getByRole('button', { name: 'Abrir checkout' }));

    expect(requestMock).toHaveBeenCalledWith(`/admin/pos/appointments/${appointments[0].id}/checkout-preview`);
    expect(await screen.findByRole('heading', { name: 'Carla' })).toBeTruthy();
    expect(screen.getAllByText('R$ 120,00').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: /Pacote Essencial/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Cadeira 1/ })).toBeTruthy();
  });

  it('consome pacote sem inventar cobrança do serviço no browser', async () => {
    requestMock
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ sale: { number: 'VEN-TESTE' } });
    const reload = vi.fn();
    const user = userEvent.setup();
    render(<AgendaCheckoutPanel appointments={appointments} reload={reload} />);

    await user.selectOptions(screen.getByLabelText('Atendimento'), appointments[0].id);
    await user.click(screen.getByRole('button', { name: 'Abrir checkout' }));
    await screen.findByRole('heading', { name: 'Pacote do cliente' });
    await user.selectOptions(screen.getByLabelText('Crédito aplicável'), '507f1f77bcf86cd799439014');
    await user.click(screen.getByRole('button', { name: 'Concluir atendimento e venda' }));

    expect(requestMock).toHaveBeenLastCalledWith(`/admin/pos/appointments/${appointments[0].id}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ packageId: '507f1f77bcf86cd799439014', payments: [] })
    });
    expect(await screen.findByText(/VEN-TESTE/)).toBeTruthy();
    expect(reload).toHaveBeenCalled();
  });
});
