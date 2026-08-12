import React, { useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';
import { AdminCrud, EditableList, Input, Select, Textarea } from '../ui/Forms.jsx';

export function FinancialAdmin({ financialEntries, reload }) {
  const emptyForm = { type: 'REVENUE', category: '', description: '', amount: '', paymentMethod: '', referenceDate: '', paid: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const revenue = financialEntries.filter((item) => item.type === 'REVENUE').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = financialEntries.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount || 0), 0);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      type: item.type || 'REVENUE',
      category: item.category || '',
      description: item.description || '',
      amount: String(item.amount || ''),
      paymentMethod: item.paymentMethod || '',
      referenceDate: item.referenceDate ? new Date(item.referenceDate).toISOString().slice(0, 10) : '',
      paid: item.paid ?? true
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveEntry() {
    await request(editingId ? `/admin/financial/${editingId}` : '/admin/financial', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary">
        <h2>Financeiro executivo</h2>
        <p className="panel-help">Receitas, despesas e resultado do salão.</p>
        <div className="mini-stats full-span">
          <div><span>Receitas</span><strong>{currency(revenue)}</strong></div>
          <div><span>Despesas</span><strong>{currency(expenses)}</strong></div>
          <div><span>Resultado</span><strong>{currency(revenue - expenses)}</strong></div>
        </div>
      </section>
      <AdminCrud title={editingId ? 'Editar lançamento' : 'Novo lançamento financeiro'} onSubmit={saveEntry} submitLabel={editingId ? 'Atualizar lançamento' : 'Salvar lançamento'}>
        <Select label="Tipo" value={form.type} onChange={(type) => setForm((current) => ({ ...current, type }))} options={[{ value: 'REVENUE', label: 'Receita' }, { value: 'EXPENSE', label: 'Despesa' }]} required />
        <Input label="Categoria" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} required />
        <Input label="Descrição" value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} required />
        <Input label="Valor" type="number" value={form.amount} onChange={(amount) => setForm((current) => ({ ...current, amount }))} required />
        <Input label="Forma de pagamento" value={form.paymentMethod} onChange={(paymentMethod) => setForm((current) => ({ ...current, paymentMethod }))} />
        <Input label="Data" type="date" value={form.referenceDate} onChange={(referenceDate) => setForm((current) => ({ ...current, referenceDate }))} />
        {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
        <EditableList items={financialEntries} render={(item) => `${item.type === 'REVENUE' ? 'Receita' : 'Despesa'} • ${item.category} • ${currency(item.amount)} • ${item.description}`} onEdit={startEdit} onDelete={async (id) => { await request(`/admin/financial/${id}`, { method: 'DELETE' }); await reload(); }} />
      </AdminCrud>
    </div>
  );
}

export function CommissionsAdmin({ commissions, professionals, reload }) {
  const emptyForm = { professionalId: '', percentage: '40', notes: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const rules = commissions?.rules || [];
  const projections = commissions?.projections || [];
  const projectedTotal = projections.reduce((sum, item) => sum + Number(item.commission ?? item.commissionAmount ?? 0), 0);

  function startEdit(rule) {
    setEditingId(rule.id);
    setForm({ professionalId: rule.professionalId || '', percentage: String(rule.percentage ?? 40), notes: rule.notes || '', active: rule.active ?? true });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveRule() {
    await request(editingId ? `/admin/commissions/rules/${editingId}` : '/admin/commissions/rules', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary">
        <h2>Comissões</h2>
        <div className="mini-stats full-span"><div><span>Regras</span><strong>{rules.length}</strong></div><div><span>Projeção</span><strong>{currency(projectedTotal)}</strong></div></div>
      </section>
      <AdminCrud title={editingId ? 'Editar regra de comissão' : 'Cadastrar regra de comissão'} onSubmit={saveRule} submitLabel={editingId ? 'Atualizar regra' : 'Salvar regra'}>
        <Select label="Profissional" value={form.professionalId} onChange={(professionalId) => setForm((current) => ({ ...current, professionalId }))} options={professionals.map((professional) => ({ value: professional.id, label: professional.name }))} required />
        <Input label="Percentual" type="number" value={form.percentage} onChange={(percentage) => setForm((current) => ({ ...current, percentage }))} required />
        <Input label="Observações" value={form.notes} onChange={(notes) => setForm((current) => ({ ...current, notes }))} />
        {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
        <EditableList items={rules} render={(rule) => `${rule.professional?.name || 'Profissional'} • ${rule.percentage}% • ${rule.active ? 'ativa' : 'inativa'}`} onEdit={startEdit} onDelete={async (id) => { await request(`/admin/commissions/rules/${id}`, { method: 'DELETE' }); await reload(); }} />
      </AdminCrud>
    </div>
  );
}

export function LoyaltyAdmin({ loyalty, clients, reload }) {
  const program = loyalty?.program || { name: 'Clube GlossFlow', pointsPerCurrency: 1, rewardDescription: '', active: true };
  const [programForm, setProgramForm] = useState({ name: program.name, pointsPerCurrency: String(program.pointsPerCurrency ?? 1), rewardDescription: program.rewardDescription || '', active: program.active ?? true });
  const [entry, setEntry] = useState({ clientId: '', type: 'EARN', points: '', reason: '' });

  async function saveProgram() {
    await request('/admin/loyalty/program', { method: 'PUT', body: JSON.stringify(programForm) });
    await reload();
  }

  async function saveEntry(event) {
    event.preventDefault();
    await request('/admin/loyalty/entries', { method: 'POST', body: JSON.stringify(entry) });
    setEntry({ clientId: '', type: 'EARN', points: '', reason: '' });
    await reload();
  }

  return (
    <div className="inventory-layout">
      <AdminCrud title="Programa de fidelidade" onSubmit={saveProgram} submitLabel="Salvar programa">
        <Input label="Nome do programa" value={programForm.name} onChange={(name) => setProgramForm((current) => ({ ...current, name }))} required />
        <Input label="Pontos por R$ 1" type="number" value={programForm.pointsPerCurrency} onChange={(pointsPerCurrency) => setProgramForm((current) => ({ ...current, pointsPerCurrency }))} required />
        <Textarea label="Recompensa" value={programForm.rewardDescription} onChange={(rewardDescription) => setProgramForm((current) => ({ ...current, rewardDescription }))} required />
      </AdminCrud>
      <form className="panel-card form-grid" onSubmit={saveEntry}>
        <h2>Movimentar pontos</h2>
        <Select label="Cliente" value={entry.clientId} onChange={(clientId) => setEntry((current) => ({ ...current, clientId }))} options={clients.map((client) => ({ value: client.id, label: client.name }))} required />
        <Select label="Tipo" value={entry.type} onChange={(type) => setEntry((current) => ({ ...current, type }))} options={[{ value: 'EARN', label: 'Ganhar pontos' }, { value: 'REDEEM', label: 'Resgatar pontos' }, { value: 'ADJUSTMENT', label: 'Ajuste' }]} required />
        <Input label="Pontos" type="number" value={entry.points} onChange={(points) => setEntry((current) => ({ ...current, points }))} required />
        <Input label="Motivo" value={entry.reason} onChange={(reason) => setEntry((current) => ({ ...current, reason }))} required />
        <button className="primary full" type="submit">Registrar pontos</button>
      </form>
    </div>
  );
}

export function SubscriptionAdmin({ subscription, reload }) {
  const plans = subscription?.plans || [];
  const current = subscription?.subscription;
  const [form, setForm] = useState({
    planId: current?.planId || '',
    status: current?.status || 'TRIAL',
    endsAt: current?.endsAt ? new Date(current.endsAt).toISOString().slice(0, 10) : ''
  });
  const [newPlan, setNewPlan] = useState({ name: '', price: '', maxUsers: '', maxSalons: '1', features: '', active: true });

  async function saveSubscription() {
    await request('/admin/subscription', { method: 'PUT', body: JSON.stringify(form) });
    await reload();
  }

  async function createPlan(event) {
    event.preventDefault();
    await request('/admin/subscription/plans', { method: 'POST', body: JSON.stringify(newPlan) });
    setNewPlan({ name: '', price: '', maxUsers: '', maxSalons: '1', features: '', active: true });
    await reload();
  }

  return (
    <div className="subscription-center">
      <section className="panel-card full-span subscription-hero">
        <div><span className="eyebrow">Planos e assinatura</span><h2>Gestão comercial do SaaS</h2><p className="panel-help">Plano atual: {current?.plan?.name || 'Sem plano'} • status {current?.status || 'N/A'}.</p></div>
      </section>
      <AdminCrud title="Atualizar assinatura do salão" onSubmit={saveSubscription} submitLabel="Atualizar assinatura">
        <Select label="Plano contratado" value={form.planId} onChange={(planId) => setForm((currentForm) => ({ ...currentForm, planId }))} options={plans.map((plan) => ({ value: plan.id, label: `${plan.name} - ${currency(plan.price)}/mês` }))} required />
        <Select label="Status comercial" value={form.status} onChange={(status) => setForm((currentForm) => ({ ...currentForm, status }))} options={[{ value: 'TRIAL', label: 'Trial / teste' }, { value: 'ACTIVE', label: 'Pago ativo' }, { value: 'PAST_DUE', label: 'Pagamento atrasado' }, { value: 'CANCELED', label: 'Cancelado' }]} required />
        <Input label="Fim do período" type="date" value={form.endsAt} onChange={(endsAt) => setForm((currentForm) => ({ ...currentForm, endsAt }))} />
      </AdminCrud>
      <form className="panel-card form-grid" onSubmit={createPlan}>
        <h2>Criar novo plano comercial</h2>
        <Input label="Nome do plano" value={newPlan.name} onChange={(name) => setNewPlan((currentPlan) => ({ ...currentPlan, name }))} required />
        <Input label="Preço mensal" type="number" value={newPlan.price} onChange={(price) => setNewPlan((currentPlan) => ({ ...currentPlan, price }))} required />
        <Input label="Máximo de usuários" type="number" value={newPlan.maxUsers} onChange={(maxUsers) => setNewPlan((currentPlan) => ({ ...currentPlan, maxUsers }))} required />
        <Input label="Máximo de unidades" type="number" value={newPlan.maxSalons} onChange={(maxSalons) => setNewPlan((currentPlan) => ({ ...currentPlan, maxSalons }))} required />
        <Textarea label="Recursos incluídos" value={newPlan.features} onChange={(features) => setNewPlan((currentPlan) => ({ ...currentPlan, features }))} required />
        <button className="primary full" type="submit">Criar plano</button>
      </form>
    </div>
  );
}
