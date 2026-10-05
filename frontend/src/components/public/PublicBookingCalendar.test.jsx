import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicBookingCalendar } from './PublicBookingCalendar.jsx';
import { request } from '../../services/api.js';
vi.mock('../../services/api.js', () => ({ request: vi.fn() }));
const services = [{ id: 's', name: 'Corte', price: 100, durationMin: 60 }];
const professionals = [{ id: 'p', name: 'Ana', specialty: 'Cabelo' }];
const month = {
  days: [
    {
      date: '2026-10-04',
      totalCapacity: 1,
      professionals: [{ professionalId: 'p', professionalName: 'Ana', capacity: 1 }]
    }
  ]
};
const day = {
  professionals: [{ id: 'p', name: 'Ana', slots: [{ label: '09:00', startTime: '2026-10-04T12:00:00Z' }] }]
};
describe('agendamento direto sem conta', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T08:00:00Z'));
    window.history.replaceState({}, '', '/?action=booking&service=s&professional=p');
    request.mockImplementation(async (url, options) =>
      options?.method === 'POST' ? { id: 'a' } : url.includes('month=') ? month : day
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });
  it('confirma serviço, profissional, horário, nome e WhatsApp sem solicitar login', async () => {
    const onCreated = vi.fn();
    render(
      <PublicBookingCalendar
        services={services}
        professionals={professionals}
        onCreated={onCreated}
        salon={{ name: 'Salão' }}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: /04 de outubro: 1 vagas/ }, { timeout: 5000 }));
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cliente Teste' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar este horário' }));
    expect(await screen.findByText('Horário reservado!')).toBeTruthy();
    const post = request.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(post[0]).toBe('/appointments');
    expect(JSON.parse(post[1].body)).toMatchObject({
      serviceId: 's',
      professionalId: 'p',
      clientName: 'Cliente Teste',
      clientPhone: '11999999999',
      startTime: '2026-10-04T12:00:00Z'
    });
    expect(screen.queryByLabelText('Senha')).toBeNull();
    expect(onCreated).toHaveBeenCalledOnce();
  });
  it('limpa o horário escolhido ao trocar serviço', async () => {
    render(
      <PublicBookingCalendar
        services={[...services, { id: 's2', name: 'Escova', price: 80, durationMin: 30 }]}
        professionals={professionals}
        onCreated={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: /04 de outubro: 1 vagas/ }, { timeout: 5000 }));
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Escova/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar este horário' })).toBeNull());
  });
  it('ignora resposta atrasada de outro dia', async () => {
    let resolveOld;
    const pending = new Promise((resolve) => {
      resolveOld = resolve;
    });
    request.mockImplementation(async (url) =>
      url.includes('month=')
        ? { days: [...month.days, { ...month.days[0], date: '2026-10-05' }] }
        : url.includes('date=2026-10-04')
          ? pending
          : {
              professionals: [
                { ...day.professionals[0], slots: [{ label: '14:00', startTime: '2026-10-05T17:00:00Z' }] }
              ]
            }
    );
    render(<PublicBookingCalendar services={services} professionals={professionals} onCreated={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /04 de outubro: 1 vagas/ }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: /05 de outubro: 1 vagas/ }));
    expect(await screen.findByRole('button', { name: '14:00' })).toBeTruthy();
    await act(async () => resolveOld(day));
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
    expect(screen.getByRole('button', { name: '14:00' })).toBeTruthy();
  });
});
