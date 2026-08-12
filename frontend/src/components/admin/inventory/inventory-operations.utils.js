export const INVENTORY_STATUS = {
  ALL: 'ALL',
  OK: 'OK',
  LOW: 'LOW',
  OUT: 'OUT',
  INACTIVE: 'INACTIVE'
};

export function inventoryStatus(product) {
  if (!product?.active) return INVENTORY_STATUS.INACTIVE;
  const quantity = Number(product.quantity || 0);
  const minimum = Number(product.minimumQuantity || 0);
  if (quantity === 0) return INVENTORY_STATUS.OUT;
  if (minimum > 0 && quantity <= minimum) return INVENTORY_STATUS.LOW;
  return INVENTORY_STATUS.OK;
}

export function filterInventory(products, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const category = String(filters.category || '');
  const supplier = String(filters.supplier || '');
  const status = filters.status || INVENTORY_STATUS.ALL;

  return (products || []).filter((product) => {
    const searchable = `${product.name || ''} ${product.category || ''} ${product.supplier || ''}`.toLowerCase();
    if (search && !searchable.includes(search)) return false;
    if (category && product.category !== category) return false;
    if (supplier && product.supplier !== supplier) return false;
    if (status !== INVENTORY_STATUS.ALL && inventoryStatus(product) !== status) return false;
    return true;
  });
}

export function recommendedPurchase(product) {
  if (inventoryStatus(product) !== INVENTORY_STATUS.LOW && inventoryStatus(product) !== INVENTORY_STATUS.OUT) return 0;
  const minimum = Number(product.minimumQuantity || 0);
  if (minimum <= 0) return 0;
  const target = minimum * 2;
  return Math.max(target - Number(product.quantity || 0), 1);
}

export function buildRestockPlan(products) {
  return (products || [])
    .filter((product) => [INVENTORY_STATUS.LOW, INVENTORY_STATUS.OUT].includes(inventoryStatus(product)))
    .filter((product) => Number(product.minimumQuantity || 0) > 0)
    .map((product) => {
      const recommendedQuantity = recommendedPurchase(product);
      return {
        ...product,
        status: inventoryStatus(product),
        recommendedQuantity,
        estimatedCost: recommendedQuantity * Number(product.costPrice || 0)
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === INVENTORY_STATUS.OUT ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
}

export function summarizeInventory(products) {
  const active = (products || []).filter((product) => product.active !== false);
  const restock = buildRestockPlan(active);
  return {
    activeProducts: active.length,
    lowStock: active.filter((product) => [INVENTORY_STATUS.LOW, INVENTORY_STATUS.OUT].includes(inventoryStatus(product))).length,
    outOfStock: active.filter((product) => inventoryStatus(product) === INVENTORY_STATUS.OUT).length,
    totalCostValue: active.reduce((sum, product) => sum + Number(product.quantity || 0) * Number(product.costPrice || 0), 0),
    potentialSaleValue: active.reduce((sum, product) => sum + Number(product.quantity || 0) * Number(product.salePrice || 0), 0),
    estimatedRestockCost: restock.reduce((sum, item) => sum + item.estimatedCost, 0)
  };
}

export function uniqueInventoryOptions(products, field) {
  return [...new Set((products || []).map((product) => String(product?.[field] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
