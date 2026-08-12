import React, { useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';
import { AdminCrud, EditableList, ImageInput, Input, Select, Textarea } from '../ui/Forms.jsx';

/** Operação administrativa fora do domínio de Agenda. */
export function UsersAdmin({ users, reload }) {
  const emptyForm = { name: '', email: '', password: '', role: 'RECEPTION', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(user) {
    setEditingId(user.id);
    setForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'RECEPTION', active: user.active ?? true });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveUser() {
    const payload = { ...form };
    if (editingId && !payload.password) delete payload.password;
    await request(editingId ? `/admin/users/${editingId}` : '/admin/users', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar usuário' : 'Cadastrar usuário'} onSubmit={saveUser} submitLabel={editingId ? 'Atualizar usuário' : 'Salvar usuário'}>
      <Input label="Nome" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
      <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} required />
      <Input label="Senha" type="password" value={form.password} onChange={(password) => setForm((current) => ({ ...current, password }))} required={!editingId} />
      <Select label="Perfil" value={form.role} onChange={(role) => setForm((current) => ({ ...current, role }))} options={[{ value: 'ADMIN', label: 'Administrador' }, { value: 'RECEPTION', label: 'Recepção' }, { value: 'PROFESSIONAL', label: 'Profissional' }]} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={users}
        render={(user) => `${user.name} • ${user.email} • ${user.role} • ${user.active ? 'ativo' : 'inativo'}`}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/users/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

export function InventoryAdmin({ inventory, reload }) {
  const emptyForm = { name: '', category: '', supplier: '', unit: 'un', quantity: '', minimumQuantity: '', costPrice: '', salePrice: '', imageUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [movement, setMovement] = useState({ productId: '', type: 'IN', quantity: '', reason: '' });

  const lowStock = inventory.filter((product) => Number(product.quantity) <= Number(product.minimumQuantity));
  const totalCostValue = inventory.reduce((sum, product) => sum + Number(product.quantity || 0) * Number(product.costPrice || 0), 0);

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
    setForm(emptyForm);
  }

  async function saveProduct() {
    await request(editingId ? `/admin/inventory/${editingId}` : '/admin/inventory', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  async function createMovement(event) {
    event.preventDefault();
    await request('/admin/inventory/movements', { method: 'POST', body: JSON.stringify(movement) });
    setMovement({ productId: '', type: 'IN', quantity: '', reason: '' });
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary">
        <h2>Controle de estoque</h2>
        <p className="panel-help">Monitore produtos, custos e pontos de reposição.</p>
        <div className="mini-stats full-span">
          <div><span>Produtos</span><strong>{inventory.length}</strong></div>
          <div><span>Estoque baixo</span><strong>{lowStock.length}</strong></div>
          <div><span>Valor em custo</span><strong>{currency(totalCostValue)}</strong></div>
        </div>
      </section>

      <AdminCrud title={editingId ? 'Editar produto' : 'Cadastrar produto'} onSubmit={saveProduct} submitLabel={editingId ? 'Atualizar produto' : 'Salvar produto'}>
        <ImageInput label="Imagem do produto" value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} />
        <Input label="Produto" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
        <Input label="Categoria" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} required />
        <Input label="Fornecedor" value={form.supplier} onChange={(supplier) => setForm((current) => ({ ...current, supplier }))} />
        <Input label="Unidade" value={form.unit} onChange={(unit) => setForm((current) => ({ ...current, unit }))} required />
        <Input label="Quantidade atual" type="number" value={form.quantity} onChange={(quantity) => setForm((current) => ({ ...current, quantity }))} required />
        <Input label="Quantidade mínima" type="number" value={form.minimumQuantity} onChange={(minimumQuantity) => setForm((current) => ({ ...current, minimumQuantity }))} required />
        <Input label="Preço de custo" type="number" value={form.costPrice} onChange={(costPrice) => setForm((current) => ({ ...current, costPrice }))} required />
        <Input label="Preço de venda opcional" type="number" value={form.salePrice} onChange={(salePrice) => setForm((current) => ({ ...current, salePrice }))} />
        {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
        <EditableList
          items={inventory}
          render={(product) => `${product.name} • ${product.quantity} ${product.unit} • mínimo ${product.minimumQuantity} • ${Number(product.quantity) <= Number(product.minimumQuantity) ? '⚠️ baixo' : 'ok'}`}
          thumbnail={(product) => product.imageUrl}
          onEdit={startEdit}
          onDelete={async (id) => { await request(`/admin/inventory/${id}`, { method: 'DELETE' }); await reload(); }}
        />
      </AdminCrud>

      <form className="panel-card form-grid" onSubmit={createMovement}>
        <h2>Movimentar estoque</h2>
        <Select label="Produto" value={movement.productId} onChange={(productId) => setMovement((current) => ({ ...current, productId }))} options={inventory.map((product) => ({ value: product.id, label: `${product.name} - ${product.quantity} ${product.unit}` }))} required />
        <Select label="Tipo" value={movement.type} onChange={(type) => setMovement((current) => ({ ...current, type }))} options={[{ value: 'IN', label: 'Entrada' }, { value: 'OUT', label: 'Saída' }, { value: 'ADJUSTMENT', label: 'Ajuste para quantidade exata' }]} required />
        <Input label="Quantidade" type="number" value={movement.quantity} onChange={(quantity) => setMovement((current) => ({ ...current, quantity }))} required />
        <Input label="Motivo" value={movement.reason} onChange={(reason) => setMovement((current) => ({ ...current, reason }))} required />
        <button className="primary full" type="submit">Registrar movimentação</button>
      </form>
    </div>
  );
}

export function ClientsAdmin({ clients, reload }) {
  const emptyForm = { name: '', phone: '', email: '', birthDate: '', preferences: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(client) {
    setEditingId(client.id);
    setForm({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      birthDate: client.birthDate ? new Date(client.birthDate).toISOString().slice(0, 10) : '',
      preferences: client.preferences || '',
      notes: client.notes || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveClient() {
    await request(editingId ? `/admin/clients/${editingId}` : '/admin/clients', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar cliente' : 'Cadastrar cliente'} onSubmit={saveClient} submitLabel={editingId ? 'Atualizar cliente' : 'Salvar cliente'}>
      <Input label="Nome" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
      <Input label="WhatsApp" value={form.phone} onChange={(phone) => setForm((current) => ({ ...current, phone }))} required />
      <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} />
      <Input label="Aniversário" type="date" value={form.birthDate} onChange={(birthDate) => setForm((current) => ({ ...current, birthDate }))} />
      <Textarea label="Preferências" value={form.preferences} onChange={(preferences) => setForm((current) => ({ ...current, preferences }))} />
      <Textarea label="Observações internas" value={form.notes} onChange={(notes) => setForm((current) => ({ ...current, notes }))} />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={clients}
        render={(client) => `${client.name} • ${client.phone} • ${client.email || 'sem e-mail'}`}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/clients/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}
