import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../../../services/api.js';
import { currency } from '../../../utils/format.js';
import { AdminCrud, EditableList, ImageInput, Input, Select } from '../../ui/Forms.jsx';
import {
  buildRestockPlan,
  filterInventory,
  INVENTORY_STATUS,
  inventoryStatus,
  summarizeInventory,
  uniqueInventoryOptions
} from './inventory-operations.utils.js';

const EMPTY_PRODUCT = {
  name: '',
  category: '',
  supplier: '',
  unit: 'un',
  quantity: '',
  minimumQuantity: '',
  costPrice: '',
  salePrice: '',
  imageUrl: ''
};

const EMPTY_MOVEMENT = { productId: '', type: 'IN', quantity: '', reason: '' };

const STATUS_LABEL = {
  [INVENTORY_STATUS.OK]: 'Saudável',
  [INVENTORY_STATUS.LOW]: 'Estoque baixo',
  [INVENTORY_STATUS.OUT]: 'Sem estoque',
  [INVENTORY_STATUS.INACTIVE]: 'Inativo'
};

function movementTypeLabel(type) {
  if (type === 'IN') return 'Entrada';
  if (type === 'OUT') return 'Saída';
  return 'Ajuste físico';
}

function movementQuantityLabel(movement, unit) {
  if (movement.type === 'ADJUSTMENT') return `Novo saldo: ${movement.quantity} ${unit}`;
  const prefix = movement.type === 'OUT' ? '-' : '+';
  return `${prefix}${movement.quantity} ${unit}`;
}

export function InventoryAdmin({ inventory, reload }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);
  const [filters, setFilters] = useState({ search: '', category: '', supplier: '', status: INVENTORY_STATUS.ALL });
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [historyProductId, setHistoryProductId] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [operationMessage, setOperationMessage] = useState('');

  const activeInventory = useMemo(() => (inventory || []).filter((product) => product.active !== false), [inventory]);
  const localOverview = useMemo(() => ({
    summary: summarizeInventory(inventory),
    restock: buildRestockPlan(inventory)
  }), [inventory]);
  const visibleInventory = useMemo(() => filterInventory(inventory, filters), [filters, inventory]);
  const categories = useMemo(() => uniqueInventoryOptions(inventory, 'category'), [inventory]);
  const suppliers = useMemo(() => uniqueInventoryOptions(inventory, 'supplier'), [inventory]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await request('/admin/inventory/overview');
      setOverview(data);
      setOverviewError('');
    } catch (error) {
      setOverview(localOverview);
      setOverviewError(error?.message || 'Resumo calculado localmente; não foi possível atualizar o painel de reposição no servidor.');
    }
  }, [localOverview]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!historyProductId) {
      setHistory(null);
      return undefined;
    }

    let active = true;
    setHistoryLoading(true);
    request(`/admin/inventory/${historyProductId}/movements`)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((error) => {
        if (active) setHistory({ error: error?.message || 'Não foi possível carregar o histórico.', product: null, movements: [] });
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [historyProductId, inventory]);

  const summary = overview?.summary || localOverview.summary;
  const restock = overview?.restock || localOverview.restock;

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      category: product.category || '',
      supplier: product.supplier || '',
      unit: product.unit || 'un',
      quantity: String(product.quantity ?? ''),
      minimumQuantity: String(product.minimumQuantity ?? ''),
      costPrice: String(product.costPrice ?? ''),
      salePrice: product.salePrice == null ? '' : String(product.salePrice),
      imageUrl: product.imageUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_PRODUCT);
  }

  async function saveProduct() {
    setOperationMessage('');
    await request(editingId ? `/admin/inventory/${editingId}` : '/admin/inventory', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    setOperationMessage(editingId ? 'Produto atualizado e trilha de estoque preservada.' : 'Produto cadastrado no estoque.');
    cancelEdit();
    await reload();
  }

  async function createMovement(event) {
    event.preventDefault();
    setOperationMessage('');
    try {
      await request('/admin/inventory/movements', { method: 'POST', body: JSON.stringify(movement) });
      const label = movement.type === 'ADJUSTMENT' ? 'Ajuste físico registrado.' : 'Movimentação registrada.';
      setOperationMessage(label);
      setMovement(EMPTY_MOVEMENT);
      await reload();
    } catch (error) {
      setOperationMessage(error?.message || 'Não foi possível registrar a movimentação.');
    }
  }

  function clearFilters() {
    setFilters({ search: '', category: '', supplier: '', status: INVENTORY_STATUS.ALL });
  }

  return (
    <div className="inventory-ops-shell">
      <section className="panel-card inventory-ops-hero">
        <div>
          <span className="eyebrow">Estoque operacional</span>
          <h2>Reposição, custo e conciliação em uma única tela</h2>
          <p>Controle o que entrou, saiu, precisa ser comprado e quanto capital está imobilizado no estoque do salão.</p>
        </div>
        <button className="secondary" type="button" onClick={loadOverview}>Atualizar reposição</button>
      </section>

      <section className="inventory-kpis" aria-label="Indicadores de estoque">
        <article><span>Produtos ativos</span><strong>{summary.activeProducts}</strong><small>Itens monitorados</small></article>
        <article><span>Estoque baixo</span><strong>{summary.lowStock}</strong><small>No mínimo ou abaixo</small></article>
        <article><span>Sem estoque</span><strong>{summary.outOfStock}</strong><small>Rupturas atuais</small></article>
        <article><span>Capital imobilizado</span><strong>{currency(summary.totalCostValue)}</strong><small>Custo do saldo atual</small></article>
        <article><span>Venda potencial</span><strong>{currency(summary.potentialSaleValue)}</strong><small>Com preços de venda cadastrados</small></article>
        <article><span>Compra sugerida</span><strong>{currency(summary.estimatedRestockCost)}</strong><small>Para recompor o estoque de segurança</small></article>
      </section>

      {overviewError && <p className="inventory-inline-warning" role="status">{overviewError}</p>}
      {operationMessage && <p className="inventory-inline-message" role="status">{operationMessage}</p>}

      <section className="panel-card inventory-restock-panel">
        <div className="inventory-section-heading">
          <div>
            <span className="eyebrow">Painel de reposição</span>
            <h2>O que comprar agora</h2>
            <p>A sugestão recompõe cada item até duas vezes o estoque mínimo configurado, criando margem antes da próxima compra.</p>
          </div>
          <strong>{restock.length} {restock.length === 1 ? 'item' : 'itens'}</strong>
        </div>
        {restock.length ? (
          <div className="inventory-restock-grid">
            {restock.map((item) => (
              <article className={`inventory-restock-card ${item.status === 'OUT' ? 'critical' : ''}`} key={item.id}>
                <div>
                  <span className={`inventory-status-badge ${item.status.toLowerCase()}`}>{item.status === 'OUT' ? 'Sem estoque' : 'Estoque baixo'}</span>
                  <h3>{item.name}</h3>
                  <p>{item.category} • {item.supplier || 'Fornecedor não informado'}</p>
                </div>
                <dl>
                  <div><dt>Saldo</dt><dd>{item.quantity} {item.unit}</dd></div>
                  <div><dt>Mínimo</dt><dd>{item.minimumQuantity} {item.unit}</dd></div>
                  <div><dt>Comprar</dt><dd>{item.recommendedQuantity} {item.unit}</dd></div>
                  <div><dt>Custo estimado</dt><dd>{currency(item.estimatedCost)}</dd></div>
                </dl>
                <button type="button" className="secondary" onClick={() => setMovement({ productId: item.id, type: 'IN', quantity: String(item.recommendedQuantity), reason: 'Reposição sugerida pelo painel de estoque.' })}>
                  Preparar entrada
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="inventory-empty-state"><strong>Reposição em dia.</strong><span>Nenhum produto ativo atingiu o estoque mínimo configurado.</span></div>
        )}
      </section>

      <section className="panel-card inventory-filter-panel">
        <div className="inventory-section-heading compact">
          <div><span className="eyebrow">Consulta operacional</span><h2>Filtrar produtos</h2></div>
          <button type="button" className="ghost-button" onClick={clearFilters}>Limpar filtros</button>
        </div>
        <div className="inventory-filters">
          <Input label="Buscar" value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder="Produto, categoria ou fornecedor" />
          <Select label="Categoria" value={filters.category} onChange={(category) => setFilters((current) => ({ ...current, category }))} options={[{ value: '', label: 'Todas' }, ...categories.map((value) => ({ value, label: value }))]} />
          <Select label="Fornecedor" value={filters.supplier} onChange={(supplier) => setFilters((current) => ({ ...current, supplier }))} options={[{ value: '', label: 'Todos' }, ...suppliers.map((value) => ({ value, label: value }))]} />
          <Select label="Situação" value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} options={[
            { value: INVENTORY_STATUS.ALL, label: 'Todas' },
            { value: INVENTORY_STATUS.OUT, label: 'Sem estoque' },
            { value: INVENTORY_STATUS.LOW, label: 'Estoque baixo' },
            { value: INVENTORY_STATUS.OK, label: 'Saudável' },
            { value: INVENTORY_STATUS.INACTIVE, label: 'Inativo' }
          ]} />
        </div>
        <p className="panel-help">{visibleInventory.length} de {inventory.length} produtos exibidos.</p>
      </section>

      <div className="inventory-ops-grid">
        <AdminCrud title={editingId ? 'Editar produto' : 'Cadastrar produto'} onSubmit={saveProduct} submitLabel={editingId ? 'Atualizar produto' : 'Salvar produto'}>
          <ImageInput label="Imagem do produto" value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} />
          <Input label="Produto" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
          <Input label="Categoria" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} required />
          <Input label="Fornecedor" value={form.supplier} onChange={(supplier) => setForm((current) => ({ ...current, supplier }))} />
          <Input label="Unidade" value={form.unit} onChange={(unit) => setForm((current) => ({ ...current, unit }))} required />
          <Input label="Quantidade atual" type="number" min="0" value={form.quantity} onChange={(quantity) => setForm((current) => ({ ...current, quantity }))} required />
          <Input label="Quantidade mínima" type="number" min="0" value={form.minimumQuantity} onChange={(minimumQuantity) => setForm((current) => ({ ...current, minimumQuantity }))} required />
          <Input label="Preço de custo" type="number" min="0" step="0.01" value={form.costPrice} onChange={(costPrice) => setForm((current) => ({ ...current, costPrice }))} required />
          <Input label="Preço de venda opcional" type="number" min="0" step="0.01" value={form.salePrice} onChange={(salePrice) => setForm((current) => ({ ...current, salePrice }))} />
          {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
          <EditableList
            items={visibleInventory}
            render={(product) => `${product.name} • ${product.quantity} ${product.unit} • mínimo ${product.minimumQuantity} • ${STATUS_LABEL[inventoryStatus(product)]}`}
            thumbnail={(product) => product.imageUrl}
            onEdit={startEdit}
            onDelete={async (id) => { await request(`/admin/inventory/${id}`, { method: 'DELETE' }); await reload(); }}
          />
        </AdminCrud>

        <form className="panel-card form-grid inventory-movement-card" onSubmit={createMovement}>
          <div className="inventory-section-heading compact">
            <div><span className="eyebrow">Movimentação</span><h2>Registrar entrada, saída ou ajuste</h2></div>
          </div>
          <Select label="Produto" value={movement.productId} onChange={(productId) => setMovement((current) => ({ ...current, productId }))} options={activeInventory.map((product) => ({ value: product.id, label: `${product.name} — ${product.quantity} ${product.unit}` }))} required />
          <Select label="Tipo" value={movement.type} onChange={(type) => setMovement((current) => ({ ...current, type }))} options={[
            { value: 'IN', label: 'Entrada' },
            { value: 'OUT', label: 'Saída' },
            { value: 'ADJUSTMENT', label: 'Ajuste para saldo físico exato' }
          ]} required />
          <Input label={movement.type === 'ADJUSTMENT' ? 'Novo saldo físico' : 'Quantidade'} type="number" min="0" value={movement.quantity} onChange={(quantity) => setMovement((current) => ({ ...current, quantity }))} required />
          <Input label="Motivo" value={movement.reason} onChange={(reason) => setMovement((current) => ({ ...current, reason }))} placeholder="Compra, consumo interno, perda, contagem física..." required />
          <p className="panel-help full">{movement.type === 'ADJUSTMENT' ? 'Use ajuste após uma contagem física. O valor informado passa a ser o saldo oficial e pode ser zero.' : 'Entradas e saídas alteram o saldo pelo valor informado e nunca podem deixar o estoque negativo.'}</p>
          <button className="primary full" type="submit">Registrar movimentação</button>
        </form>
      </div>

      <section className="panel-card inventory-history-panel">
        <div className="inventory-section-heading">
          <div><span className="eyebrow">Trilha operacional</span><h2>Histórico por produto</h2><p>Até 100 movimentações mais recentes, sempre isoladas pelo salão autenticado.</p></div>
          <Select label="Produto" value={historyProductId} onChange={setHistoryProductId} options={[{ value: '', label: 'Selecione um produto' }, ...inventory.map((product) => ({ value: product.id, label: product.name }))]} />
        </div>
        {historyLoading && <p className="panel-help">Carregando histórico...</p>}
        {!historyLoading && !historyProductId && <div className="inventory-empty-state"><strong>Selecione um produto.</strong><span>O histórico aparecerá aqui sem carregar todas as movimentações na abertura do painel.</span></div>}
        {!historyLoading && history?.error && <p className="inventory-inline-warning" role="alert">{history.error}</p>}
        {!historyLoading && history?.product && (
          <div className="inventory-history-list">
            <div className="inventory-history-balance"><span>Saldo atual</span><strong>{history.product.quantity} {history.product.unit}</strong></div>
            {history.movements.length ? history.movements.map((item) => (
              <article key={item.id} className="inventory-history-row">
                <div><strong>{movementTypeLabel(item.type)}</strong><span>{item.reason}</span></div>
                <div><strong>{movementQuantityLabel(item, history.product.unit)}</strong><time>{new Date(item.createdAt).toLocaleString('pt-BR')}</time></div>
              </article>
            )) : <div className="inventory-empty-state"><strong>Sem movimentações.</strong><span>Este produto ainda não possui eventos de estoque registrados.</span></div>}
          </div>
        )}
      </section>
    </div>
  );
}
