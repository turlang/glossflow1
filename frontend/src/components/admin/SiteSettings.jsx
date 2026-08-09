import React, { useEffect, useState } from 'react';
import { request } from '../../services/api';
import { AdminCrud, ImageInput, Input, SectionTitle, Select, Textarea } from '../ui/Forms.jsx';

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
}

export function SiteSettings({ salon, reload, setPage }) {
  const [form, setForm] = useState({
    name: '', description: '', phone: '', whatsapp: '', address: '', openingHours: '', instagram: '', heroImage: '',
    heroTitle: '', logoUrl: '', primaryColor: '#C49A6C', secondaryColor: '#171311', accentColor: '#F7F1EA',
    siteTemplate: 'ELEGANCE', customDomain: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!salon) return;
    setForm({
      name: salon.name || '',
      description: salon.description || '',
      phone: salon.phone || '',
      whatsapp: salon.whatsapp || '',
      address: salon.address || '',
      openingHours: salon.openingHours || '',
      instagram: salon.instagram || '',
      heroImage: salon.heroImage || '',
      heroTitle: salon.heroTitle || '',
      logoUrl: salon.logoUrl || '',
      primaryColor: salon.primaryColor || '#C49A6C',
      secondaryColor: salon.secondaryColor || '#171311',
      accentColor: salon.accentColor || '#F7F1EA',
      siteTemplate: salon.siteTemplate || 'ELEGANCE',
      customDomain: salon.customDomain || ''
    });
  }, [salon]);

  async function save() {
    setMessage('Salvando identidade do site...');
    try {
      await request('/admin/salon', {
        method: 'PUT',
        body: JSON.stringify({ ...form, customDomain: normalizeDomain(form.customDomain) })
      });
      await reload();
      setMessage('Site atualizado. As mudanças já pertencem somente a este salão.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar o site.');
    }
  }

  if (!salon) return null;

  return (
    <main className="container" style={{ maxWidth: 1120 }}>
      <SectionTitle
        label="Site & Marca"
        title={`Vitrine white-label • ${salon.name}`}
        text="Personalize este salão sem duplicar o GlossFlow. Serviços, equipe, agenda e galeria continuam isolados pelo tenant."
      />

      <AdminCrud title="Identidade do salão" onSubmit={save} submitLabel="Salvar e publicar">
        <ImageInput label="Logo" value={form.logoUrl} onChange={(logoUrl) => setForm({ ...form, logoUrl })} />
        <ImageInput label="Imagem principal / Hero" value={form.heroImage} onChange={(heroImage) => setForm({ ...form, heroImage })} />
        <Input label="Nome do salão" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <Input label="Título principal" value={form.heroTitle} onChange={(heroTitle) => setForm({ ...form, heroTitle })} />
        <Textarea label="Apresentação" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
        <Input label="WhatsApp" value={form.whatsapp} onChange={(whatsapp) => setForm({ ...form, whatsapp })} required />
        <Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} required />
        <Input label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} />
        <Input label="Endereço" value={form.address} onChange={(address) => setForm({ ...form, address })} required />
        <Input label="Horário de funcionamento" value={form.openingHours} onChange={(openingHours) => setForm({ ...form, openingHours })} required />

        <Select
          label="Template visual"
          value={form.siteTemplate}
          onChange={(siteTemplate) => setForm({ ...form, siteTemplate })}
          options={[
            { value: 'ELEGANCE', label: 'Elegance • sofisticado' },
            { value: 'LUXURY', label: 'Luxury • premium escuro' },
            { value: 'MINIMAL', label: 'Minimal • clean editorial' },
            { value: 'URBAN', label: 'Urban • moderno e forte' }
          ]}
        />
        <Input label="Cor principal" type="color" value={form.primaryColor} onChange={(primaryColor) => setForm({ ...form, primaryColor })} />
        <Input label="Cor secundária" type="color" value={form.secondaryColor} onChange={(secondaryColor) => setForm({ ...form, secondaryColor })} />
        <Input label="Cor de destaque" type="color" value={form.accentColor} onChange={(accentColor) => setForm({ ...form, accentColor })} />
        <Input
          label="Domínio próprio (opcional)"
          value={form.customDomain}
          onChange={(customDomain) => setForm({ ...form, customDomain })}
          placeholder="www.salaocliente.com.br"
        />

        {message && <p className="feedback full">{message}</p>}
      </AdminCrud>

      <section className="panel-card" style={{ marginTop: 24 }}>
        <span className="eyebrow">Identificação do tenant</span>
        <h2>Slug: {salon.slug}</h2>
        <p className="panel-help">
          Para homologação, use <strong>?salon={salon.slug}</strong>. Em produção, o mesmo tenant pode ser resolvido por subdomínio ou pelo domínio próprio cadastrado acima.
        </p>
        <div className="hero-actions">
          <button className="primary" type="button" onClick={() => setPage('public')}>Ver site agora</button>
          <button className="secondary" type="button" onClick={() => setPage('admin')}>Voltar ao painel</button>
        </div>
      </section>
    </main>
  );
}
