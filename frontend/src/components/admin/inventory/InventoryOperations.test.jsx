import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { request } from '../../../services/api.js';
import { InventoryAdmin } from './InventoryOperations.jsx';

vi.mock('../../../services/api.js', () => ({ request: vi.fn() }));

const inventory = [
  { id: 'p1', name: 'Shampoo', category: 'Cabelo', supplier: 'Fornecedor A', unit: 'un', active: true, quantity: 1, minimumQuantity: 2, costPrice: 20, salePrice: 35, imageUrl: '', movements: [] },
  { id: 'p2', name: 'Máscara', category: 'Cabelo', supplier: 'Fornecedor B', unit: 'un', active: true, quantity: 0, minimumQuantity: 3, costPrice: 15, salePrice: 30, imageUrl: '', movements: [] },
  { id: 'p3', name: 'Óleo', category: 'Finalização', supplier: 'Fornecedor A', unit: 'un', active: true, quantity: 5, minimumQuantity: 2, costPrice: 10, salePrice: null, imageUrl: '', movements: [] }
];

const overview = {
  summary: { activeProducts: 3, lowStock: 2, outOfStock: 1, totalCostValue: 70, potentialSaleValue: 35, estimatedRestockCost: 150 },
  restock: [
    { ...inventory[1], status: 'OUT', recommendedQuantity: 6, estimatedCost: 90 },
    { ...inventory[0], status: 'LOW', recommendedQuantity: 3, estimatedCost: 60 }
  ]
};

describe('InventoryOperations', () => {
  beforeEach(() => {
    request.mockImplementation(async (url) => {
      if (url === '/admin/inventory/overview') return overview;
      if (url === '/admin/inventory/p1/movements') {
        return {
          product: { id: 'p1', name: 'Shampoo', unit: 'un', quantity: 4, active: true },
          movements: [{ id: 'm1', type: 'IN', quantity: 3, reason: 'Compra do fornecedor', createdAt: '2026-08-12T10:00:00.000Z' }]
        };
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('exibe ruptura, capital imobilizado e fila de reposição', async () => {
    render(<InventoryAdmin inventory={inventory} reload={vi.fn()} />);
    expect(screen.getByText('O que comprar agora')).toBeTruthy();
    const kpis = screen.getByRole('region', { name: 'Indicadores de estoque' });
    expect(within(kpis).getByText('Sem estoque')).toBeTruthy();
    expect(within(kpis).getByText('Capital imobilizado')).toBeTruthy();
    expect(within(kpis).getByText(/70,00/)).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/inventory/overview'));
  });

  it('prepara uma entrada usando a quantidade sugerida pelo painel', async () => {
    const user = userEvent.setup();
    render(<InventoryAdmin inventory={inventory} reload={vi.fn()} />);
    const buttons = await screen.findAllByRole('button', { name: 'Preparar entrada' });
    await user.click(buttons[0]);
    expect(screen.getByLabelText('Quantidade').value).toBe('6');
    expect(screen.getByLabelText('Motivo').value).toMatch(/Reposição sugerida/i);
  });

  it('carrega histórico completo somente quando um produto é selecionado', async () => {
    const user = userEvent.setup();
    render(<InventoryAdmin inventory={inventory} reload={vi.fn()} />);
    const section = screen.getByRole('heading', { name: 'Histórico por produto' }).closest('section');
    const productSelect = within(section).getByLabelText('Produto');
    await user.selectOptions(productSelect, 'p1');
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/inventory/p1/movements'));
    expect(await within(section).findByText('Compra do fornecedor')).toBeTruthy();
    expect(within(section).getByText('+3 un')).toBeTruthy();
  });
});
