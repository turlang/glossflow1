import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { ImageInput, Input, Textarea } from '../ui/Forms.jsx';

const TEMPLATES = [
  { id: 'ELEGANCE', name: 'Elegance', description: 'Sofisticado, leve e acolhedor' },
  { id: 'LUXURY', name: 'Luxury', description: 'Premium escuro e impactante' },
  { id: 'MINIMAL', name: 'Minimal', description: 'Clean, editorial e direto' },
  { id: 'URBAN', name: 'Urban', description: 'Moderno, forte e contemporâneo' }
];

function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

function formFromSalon(salon) {
  return {
    name: salon?.name || '',
    description: salon?.description || '',
    phone: salon?.phone || '',
    whatsapp: salon?.whatsapp || '',
    address: salon?.address || '',
    openingHours: salon?.openingHours || '',
    instagram: salon?.instagram || '',
    heroImage: salon?.heroImage || '',
    heroTitle: salon?.heroTitle || '',
    logoUrl: salon?.logoUrl || '',
    primaryColor: salon?.primaryColor || '#C49A6C',
    secondaryColor: salon?.secondaryColor || '#171311',
    accentColor: salon?.accentColor || '#F7F1EA',
    siteTemplate: salon?.siteTemplate || 'ELEGANCE',
    customDomain: salon?.customDomain || ''
  };
}

function Preview({ form, services, professionals, mobile }) {
  const hero = form.heroImage || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1600&auto=format&fit=crop';
  const dark = form.siteTemplate === 'LUXURY' || form.siteTemplate === 'URBAN';
  const bg = dark ? '#10131b' : '#f7f3ee';
  const text = dark ? '#f8fafc' : '#211b18';
  const surface = dark ? '#171d29' : '#ffffff';
  const radius = form.siteTemplate === 'MINIMAL' ? 3 : form.siteTemplate === 'LUXURY' ? 10 : 20;

  return (
    <div style={{ width: mobile ? 390 : '100%', maxWidth: '100%', margin: '0 auto', border: '1px solid var(--line)', borderRadius: 24, overflow: 'hidden', background: bg, color: text }}>
      <header style={{ minHeight: 60, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {form.logoUrl ? <img src={form.logoUrl} alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 10 }} /> : <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, background: form.primaryColor, color: '#111', fontWeight: 900 }}>{(form.name || 'S')[0]}</span>}
          <strong>{form.name || 'Seu salão'}</strong>
        </div>
        <small style={{ color: form.primaryColor, fontWeight: 800 }}>Agendar</small>
      </header>

      <section style={{ minHeight: mobile ? 300 : 390, padding: mobile ? '38px 24px' : '56px 44px', display: 'flex', alignItems: 'flex-end', backgroundImage: `linear-gradient(90deg,rgba(8,8,12,.84),rgba(8,8,12,.25)),url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ maxWidth: 590, color: '#fff' }}>
          <small style={{ color: form.accentColor, textTransform: 'uppercase', letterSpacing: '.16em', fontWeight: 900 }}>{form.name || 'Seu salão'}</small>
          <h2 style={{ margin: '8px 0', fontSize: mobile ? 34 : 48, lineHeight: 1 }}>{form.heroTitle || form.name || 'Sua beleza, do seu jeito'}</h2>
          <p style={{ opacity: .85, lineHeight: 1.5 }}>{form.description || 'Apresentação do salão e seus principais diferenciais.'}</p>
          <button type="button" style={{ border: 0, padding: '10px 16px', borderRadius: radius, background: form.primaryColor, fontWeight: 900 }}>Agendar agora</button>
        </div>
      </section>

      <section style={{ padding: mobile ? 20 : 30 }}>
        <small style={{ color: form.primaryColor, fontWeight: 900 }}>SERVIÇOS</small>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
          {(services?.length ? services.slice(0, 3) : [{ id: 'sample', name: 'Serviço premium', price: 120 }]).map((service) => (
            <article key={service.id} style={{ padding: 14, background: surface, borderRadius: radius, border: `1px solid ${form.primaryColor}22` }}>
              <strong>{service.name}</strong><br/><small style={{ color: form.primaryColor }}>R$ {Number(service.price || 0).toFixed(2).replace('.', ',')}</small>
            </article>
          ))}
        </div>
        {professionals?.length > 0 && <p style={{ marginTop: 16, opacity: .7, fontSize: 12 }}>Equipe: {professionals.slice(0, 3).map((item) => item.name).join(' • ')}</p>}
      </section>

      <footer style={{ padding: 16, background: form.secondaryColor || '#171311', color: '#fff', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>{form.openingHours || 'Horário de funcionamento'}</span><span>{form.address || 'Endereço'}</span>
      </footer>
    </div>
  );
}

export function PlatformSiteManager({ salons = [] }) {
  const [salonId, setSalonId] = useState('');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [section, setSection] = useState('identity');
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!salonId && salons.length) setSalonId(salons[0].id);
  }, [salons, salonId]);

  useEffect(() => {
    if (!salonId) return;
    let active = true;
    setLoading(true);
    setMessage('');
    request(`/platform-admin/salons/${salonId}/site`)
      .then((result) => {
        if (!active) return;
        const next = formFromSalon(result.salon);
        setData(result);
        setForm(next);
        setSaved(JSON.stringify(next));
      })
      .catch((error) => active && setMessage(error.message || 'Não foi possível carregar Site & Marca.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [salonId]);

  const dirty = useMemo(() => form && JSON.stringify(form) !== saved, [form, saved]);
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!salonId || !form) return;
    setSaving(true);
    setMessage('Publicando Site & Marca...');
    try {
      const payload = { ...form, customDomain: normalizeDomain(form.customDomain) };
      const updated = await request(`/platform-admin/salons/${salonId}/site`, { method: 'PUT', body: JSON.stringify(payload) });
      const next = formFromSalon(updated);
      setForm(next);
      setSaved(JSON.stringify(next));
      setData((current) => ({ ...current, salon: updated }));
      setMessage('Site & Marca publicado com sucesso para este cliente.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível publicar Site & Marca.');
    } finally {
      setSaving(false);
    }
  }

  const selected = salons.find((item) => item.id === salonId);
  const nav = [
    ['identity', 'Identidade'], ['hero', 'Hero'], ['contact', 'Contato'], ['appearance', 'Cores & Template'], ['domain', 'Domínio']
  ];

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div className="panel-card">
        <span className="eyebrow">White-label por cliente</span>
        <h2>Site & Marca</h2>
        <p className="panel-help">Somente o Super Admin publica a identidade visual dos salões. Escolha o cliente abaixo.</p>
        <label style={{ display: 'block', maxWidth: 520, marginTop: 14 }}><span>Salão</span><select value={salonId} onChange={(event) => setSalonId(event.target.value)}><option value="">Selecione um cliente</option>{salons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name} — {salon.slug}</option>)}</select></label>
      </div>

      {message && <div className="panel-card"><p className="feedback">{message}</p></div>}
      {loading && <div className="panel-card"><p>Carregando editor...</p></div>}

      {!loading && form && data && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px,.75fr) minmax(480px,1.25fr)', gap: 18, alignItems: 'start' }}>
        <div className="panel-card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>{nav.map(([key, label]) => <button key={key} type="button" className={section === key ? 'primary' : 'secondary'} onClick={() => setSection(key)}>{label}</button>)}</div>

          {section === 'identity' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}><ImageInput label="Logo" value={form.logoUrl} onChange={(value) => patch('logoUrl', value)} /><Input label="Nome do salão" value={form.name} onChange={(value) => patch('name', value)} required/><Textarea label="Apresentação" value={form.description} onChange={(value) => patch('description', value)} required/></div>}
          {section === 'hero' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}><ImageInput label="Imagem principal / Hero" value={form.heroImage} onChange={(value) => patch('heroImage', value)} /><Input label="Título principal" value={form.heroTitle} onChange={(value) => patch('heroTitle', value)} /></div>}
          {section === 'contact' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}><Input label="WhatsApp" value={form.whatsapp} onChange={(value) => patch('whatsapp', value)} required/><Input label="Telefone" value={form.phone} onChange={(value) => patch('phone', value)} required/><Input label="Instagram" value={form.instagram} onChange={(value) => patch('instagram', value)} /><Input label="Horário" value={form.openingHours} onChange={(value) => patch('openingHours', value)} required/><Input label="Endereço" value={form.address} onChange={(value) => patch('address', value)} required/></div>}
          {section === 'appearance' && <div style={{ display: 'grid', gap: 14 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>{TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => patch('siteTemplate', template.id)} style={{ padding: 14, textAlign: 'left', borderRadius: 16, border: `1px solid ${form.siteTemplate === template.id ? 'var(--gold)' : 'var(--line)'}`, background: form.siteTemplate === template.id ? 'rgba(214,179,95,.12)' : 'rgba(255,255,255,.03)', color: 'var(--text)' }}><strong>{template.name}</strong><br/><small>{template.description}</small></button>)}</div><div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}><Input label="Principal" type="color" value={form.primaryColor} onChange={(value) => patch('primaryColor', value)} /><Input label="Secundária" type="color" value={form.secondaryColor} onChange={(value) => patch('secondaryColor', value)} /><Input label="Destaque" type="color" value={form.accentColor} onChange={(value) => patch('accentColor', value)} /></div></div>}
          {section === 'domain' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}><Input label="Domínio próprio" value={form.customDomain} onChange={(value) => patch('customDomain', value)} /><div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 14 }}><small>Slug do tenant</small><strong style={{ display: 'block' }}>{data.salon.slug}</strong><code>?salon={data.salon.slug}</code></div></div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button className="primary" type="button" disabled={!dirty || saving} onClick={save}>{saving ? 'Publicando...' : 'Salvar e publicar'}</button>
            <button className="secondary" type="button" disabled={!dirty || saving} onClick={() => { const next = formFromSalon(data.salon); setForm(next); setMessage('Alterações descartadas.'); }}>Reverter</button>
            {selected && <button className="secondary" type="button" onClick={() => window.open(`/?salon=${encodeURIComponent(selected.slug)}`, '_blank', 'noopener,noreferrer')}>Ver site publicado</button>}
          </div>
        </div>

        <div className="panel-card" style={{ position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}><div><span className="eyebrow">Prévia ao vivo</span><h2 style={{ margin: 0 }}>{selected?.name}</h2></div><div style={{ display: 'flex', gap: 8 }}><button className={!mobile ? 'primary' : 'secondary'} type="button" onClick={() => setMobile(false)}>Desktop</button><button className={mobile ? 'primary' : 'secondary'} type="button" onClick={() => setMobile(true)}>Mobile</button></div></div>
          <Preview form={form} services={data.services} professionals={data.professionals} mobile={mobile}/>
          <p className="panel-help" style={{ marginTop: 12 }}>{dirty ? 'A prévia contém alterações ainda não publicadas.' : 'A prévia está sincronizada com o site publicado.'}</p>
        </div>
      </div>}
    </section>
  );
}
