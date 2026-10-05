import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicShowcase } from './PublicExperience.jsx';

const salon = {
  name: 'Salão Exemplo',
  description: 'Atendimento cuidadoso e personalizado.',
  whatsapp: '5511999999999',
  openingHours: 'Segunda a sábado',
  address: 'São Paulo, SP'
};

describe('PublicShowcase', () => {
  afterEach(cleanup);

  it('mantém a primeira tela enxuta e deixa serviços e equipe acessíveis no painel', async () => {
    const user = userEvent.setup();
    render(
      <PublicShowcase
        salon={salon}
        services={[{ id: 'service-1', name: 'Corte', description: 'Corte personalizado', price: 90, durationMin: 60 }]}
        professionals={[{ id: 'professional-1', name: 'Ana', specialty: 'Cabelo', bio: 'Especialista em cortes' }]}
        portfolio={[]}
        setPage={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Agendar agora' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Conhecer o salão' }));
    expect(screen.getByRole('dialog', { name: 'Detalhes do salão' })).toBeTruthy();
    expect(screen.getByText('Corte')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
