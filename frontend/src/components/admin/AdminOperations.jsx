import React, { useState } from 'react';
import { request } from '../../services/api.js';
import { AdminCrud, EditableList, Input, Select, Textarea } from '../ui/Forms.jsx';

/** Operação administrativa fora dos domínios especializados de Agenda e Estoque. */
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
