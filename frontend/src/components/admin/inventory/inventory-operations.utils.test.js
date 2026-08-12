import { describe, expect, it } from 'vitest';
import {
  buildRestockPlan,
  filterInventory,
  INVENTORY_STATUS,
  inventoryStatus,
  recommendedPurchase,
  summarizeInventory,
  uniqueInventoryOptions
} from './inventory-operations.utils.js';

const products = [
  { id: '1', name: 'Shampoo', category: 'Cabelo', supplier: 'Fornecedor A', active: true, quantity: 1, minimumQuantity: 2, costPrice: 20, salePrice: 35 },
  { id: '2', name: 'Máscara', category: 'Cabelo', supplier: 'Fornecedor B', active: true, quantity: 0, minimumQuantity: 3, costPrice: 15, salePrice: 30 },
  { id: '3', name: 'Óleo', category: 'Finalização', supplier: 'Fornecedor A', active: true, quantity: 5, minimumQuantity: 2, costPrice: 10, salePrice: null },
  { id: '4', name: 'Antigo', category: 'Legado', supplier: '', active: false, quantity: 8, minimumQuantity: 2, costPrice: 100, salePrice: 150 }
];

describe('inventory operations utils', () => {
  it('classifica ruptura, estoque baixo, saudável e inativo', () => {
    expect(inventoryStatus(products[0])).toBe(INVENTORY_STATUS.LOW);
    expect(inventoryStatus(products[1])).toBe(INVENTORY_STATUS.OUT);
    expect(inventoryStatus(products[2])).toBe(INVENTORY_STATUS.OK);
    expect(inventoryStatus(products[3])).toBe(INVENTORY_STATUS.INACTIVE);
  });

  it('combina busca, categoria, fornecedor e situação', () => {
    expect(filterInventory(products, { search: 'shamp', category: 'Cabelo', supplier: 'Fornecedor A', status: INVENTORY_STATUS.LOW }).map((item) => item.id)).toEqual(['1']);
    expect(filterInventory(products, { status: INVENTORY_STATUS.OUT }).map((item) => item.id)).toEqual(['2']);
  });

  it('calcula resumo somente sobre produtos ativos', () => {
    expect(summarizeInventory(products)).toEqual({
      activeProducts: 3,
      lowStock: 2,
      outOfStock: 1,
      totalCostValue: 70,
      potentialSaleValue: 35,
      estimatedRestockCost: 150
    });
  });

  it('monta plano de reposição priorizando ruptura', () => {
    const plan = buildRestockPlan(products);
    expect(plan.map((item) => item.id)).toEqual(['2', '1']);
    expect(plan[0].recommendedQuantity).toBe(6);
    expect(plan[0].estimatedCost).toBe(90);
    expect(plan[1].recommendedQuantity).toBe(3);
    expect(plan[1].estimatedCost).toBe(60);
  });

  it('recomenda compra até duas vezes o mínimo configurado', () => {
    expect(recommendedPurchase(products[0])).toBe(3);
    expect(recommendedPurchase(products[1])).toBe(6);
    expect(recommendedPurchase(products[2])).toBe(0);
  });

  it('gera opções únicas e ordenadas para filtros', () => {
    expect(uniqueInventoryOptions(products, 'supplier')).toEqual(['Fornecedor A', 'Fornecedor B']);
    expect(uniqueInventoryOptions(products, 'category')).toEqual(['Cabelo', 'Finalização', 'Legado']);
  });
});
