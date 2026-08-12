import React, { useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';
import { AdminCrud, EditableList, ImageInput, Input, Textarea } from '../ui/Forms.jsx';

/** Catálogo administrativo: serviços, profissionais e vitrine. */
export function ServicesAdmin({ services, reload }) {
  const emptyForm = { name: '', description: '', price: '', durationMin: '', imageUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(service) {
    setEditingId(service.id);
    setForm({
      name: service.name || '',
      description: service.description || '',
      price: String(service.price ?? ''),
      durationMin: String(service.durationMin ?? ''),
      imageUrl: service.imageUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveService() {
    await request(editingId ? `/admin/services/${editingId}` : '/admin/services', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar serviço' : 'Cadastrar serviço'} onSubmit={saveService} submitLabel={editingId ? 'Atualizar serviço' : 'Salvar serviço'}>
      <ImageInput label="Imagem do serviço" value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} />
      <Input label="Nome" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
      <Textarea label="Descrição" value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} required />
      <Input label="Preço" type="number" value={form.price} onChange={(price) => setForm((current) => ({ ...current, price }))} required />
      <Input label="Duração em minutos" type="number" value={form.durationMin} onChange={(durationMin) => setForm((current) => ({ ...current, durationMin }))} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={services}
        render={(service) => `${service.name} • ${currency(service.price)} • ${service.durationMin} min`}
        thumbnail={(service) => service.imageUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/services/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

export function ProfessionalsAdmin({ professionals, reload }) {
  const emptyForm = { name: '', specialty: '', bio: '', photoUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(professional) {
    setEditingId(professional.id);
    setForm({
      name: professional.name || '',
      specialty: professional.specialty || '',
      bio: professional.bio || '',
      photoUrl: professional.photoUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveProfessional() {
    await request(editingId ? `/admin/professionals/${editingId}` : '/admin/professionals', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar profissional' : 'Cadastrar profissional'} onSubmit={saveProfessional} submitLabel={editingId ? 'Atualizar profissional' : 'Salvar profissional'}>
      <ImageInput label="Foto do profissional" value={form.photoUrl} onChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))} />
      <Input label="Nome" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
      <Input label="Especialidade" value={form.specialty} onChange={(specialty) => setForm((current) => ({ ...current, specialty }))} required />
      <Textarea label="Biografia" value={form.bio} onChange={(bio) => setForm((current) => ({ ...current, bio }))} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={professionals}
        render={(professional) => `${professional.name} • ${professional.specialty}`}
        thumbnail={(professional) => professional.photoUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/professionals/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

export function PortfolioAdmin({ portfolio, reload }) {
  const emptyForm = { title: '', description: '', imageUrl: '', category: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      category: item.category || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function savePortfolioItem() {
    await request(editingId ? `/admin/portfolio/${editingId}` : '/admin/portfolio', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar item da vitrine' : 'Adicionar trabalho na vitrine'} onSubmit={savePortfolioItem} submitLabel={editingId ? 'Atualizar vitrine' : 'Salvar na vitrine'}>
      <ImageInput label="Imagem da vitrine" value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} required />
      <Input label="Título" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} required />
      <Input label="Categoria" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} required />
      <Textarea label="Descrição" value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={portfolio}
        render={(item) => `${item.title} • ${item.category}`}
        thumbnail={(item) => item.imageUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/portfolio/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}
