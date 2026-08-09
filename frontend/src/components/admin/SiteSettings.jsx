import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { ImageInput, Input, SectionTitle, Textarea } from '../ui/Forms.jsx';

const TABS = [
  { id: 'identity', label: 'Identidade', icon: '✦' },
  { id: 'hero', label: 'Hero', icon: '▣' },
  { id: 'contact', label: 'Contato', icon: '☎' },
  { id: 'appearance', label: 'Cores & Template', icon: '◈' },
  { id: 'domain', label: 'Domínio', icon: '↗' }
];

const TEMPLATES = [
  { id: 'ELEGANCE', name: 'Elegance', description: 'Sofisticado, leve e acolhedor', sample: ['#f7f1ea', '#c49a6c', '#2d211d'] },
  { id: 'LUXURY', name: 'Luxury', description: 'Premium escuro e impactante', sample: ['#0d0b0b', '#d6b35f', '#f8f4eb'] },
  { id: 'MINIMAL', name: 'Minimal', description: 'Clean, editorial e direto', sample: ['#ffffff', '#171717', '#e8e8e8'] },
  { id: 'URBAN', name: 'Urban', description: 'Moderno, forte e contemporâneo', sample: ['#111827', '#7c3aed', '#e5e7eb'] }
];

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
}

function fromSalon(salon) {
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

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function templateProfile(template) {
  if (template === 'LUXURY') return { page: '#0c0b0b', surface: '#171313', text: '#f8f4eb', muted: '#b7ada0', radius: 10, font: 'Georgia, serif' };
  if (template === 'MINIMAL') return { page: '#f8f8f6', surface: '#ffffff', text: '#171717', muted: '#6b6b6b', radius: 2, font: 'Arial, sans-serif' };
  if (template === 'URBAN') return { page: '#101827', surface: '#172033', text: '#f8fafc', muted: '#aab4c8', radius: 8, font: 'Arial, sans-serif' };
  return { page: '#f7f1ea', surface: '#fffaf5', text: '#2d211d', muted: '#7b6d64', radius: 22, font: 'Georgia, serif' };
}

function Preview({ form, services, professionals, mode }) {
  const profile = templateProfile(form.siteTemplate);
  const width = mode === 'mobile' ? 390 : '100%';
  const serviceItems = (services || []).slice(0, mode === 'mobile' ? 2 : 3);
  const professionalItems = (professionals || []).slice(0, mode === 'mobile' ? 1 : 2);
  const hero = form.heroImage || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1600&auto=format&fit=crop';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div style={{ width, maxWidth: '100%', background: '#080b12', border: '1px solid rgba(255,255,255,.13)', borderRadius: 24, padding: 10, boxShadow: '0 24px 70px rgba(0,0,0,.32)', transition: 'width .22s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px 10px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#ff6b6b' }} />
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#ffd43b' }} />
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#51cf66' }} />
          <div style={{ marginLeft: 8, flex: 1, height: 22, borderRadius: 999, background: 'rgba(255,255,255,.08)', color: '#8f9bad', fontSize: 10, display: 'grid', placeItems: 'center' }}>
            {form.customDomain || `${(form.name || 'salao').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.glossflow.com.br`}
          </div>
        </div>

        <div style={{ overflow: 'hidden', background: profile.page, borderRadius: 16, minHeight: 620, fontFamily: profile.font, color: profile.text }}>
          <div style={{ height: 58, padding: mode === 'mobile' ? '0 14px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: profile.surface, borderBottom: `1px solid ${form.primaryColor}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {form.logoUrl ? <img src={form.logoUrl} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 9 }} /> : <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, background: form.primaryColor, color: '#111', fontWeight: 900 }}>{(form.name || 'S').charAt(0)}</span>}
              <strong style={{ fontSize: mode === 'mobile' ? 12 : 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || 'Seu salão'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: profile.muted }}>
              <span>Serviços</span>
              {mode !== 'mobile' && <span>Equipe</span>}
              <span style={{ color: form.primaryColor, fontWeight: 800 }}>Agendar</span>
            </div>
          </div>

          <section style={{ minHeight: mode === 'mobile' ? 320 : 390, padding: mode === 'mobile' ? '42px 24px' : '58px 46px', display: 'grid', alignItems: 'end', backgroundImage: `linear-gradient(90deg, rgba(10,8,8,.82), rgba(10,8,8,.24)), url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div style={{ maxWidth: 560, color: '#fff' }}>
              <span style={{ display: 'inline-block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.16em', color: form.accentColor, fontWeight: 900 }}>{form.name || 'Seu salão'}</span>
              <h2 style={{ margin: '8px 0 10px', fontSize: mode === 'mobile' ? 32 : 46, lineHeight: .96, letterSpacing: '-.04em', color: '#fff' }}>{form.heroTitle || form.name || 'Sua beleza, do seu jeito'}</h2>
              <p style={{ margin: 0, maxWidth: 470, fontFamily: 'Arial, sans-serif', fontSize: mode === 'mobile' ? 12 : 13, lineHeight: 1.55, color: 'rgba(255,255,255,.82)' }}>{form.description || 'Apresente aqui a proposta e os diferenciais do seu salão.'}</p>
              <button type="button" style={{ marginTop: 18, border: 0, borderRadius: profile.radius, padding: '10px 16px', background: form.primaryColor, color: '#111', fontWeight: 900 }}>Agendar agora</button>
            </div>
          </section>

          <section style={{ padding: mode === 'mobile' ? 22 : 32 }}>
            <div style={{ marginBottom: 16 }}>
              <small style={{ color: form.primaryColor, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.13em' }}>Serviços</small>
              <h3 style={{ margin: '4px 0', fontSize: mode === 'mobile' ? 22 : 28 }}>Cuidados para você</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mode === 'mobile' ? '1fr' : `repeat(${Math.max(serviceItems.length, 1)}, minmax(0, 1fr))`, gap: 12 }}>
              {(serviceItems.length ? serviceItems : [{ id: 'sample', name: 'Serviço premium', price: 120, durationMin: 60 }]).map((service) => (
                <article key={service.id} style={{ padding: 14, background: profile.surface, border: `1px solid ${form.primaryColor}22`, borderRadius: profile.radius }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{service.name}</strong>
                  <span style={{ display: 'block', marginTop: 6, color: form.primaryColor, fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12 }}>{money(service.price)}</span>
                  <small style={{ color: profile.muted, fontFamily: 'Arial, sans-serif' }}>{service.durationMin || 60} min</small>
                </article>
              ))}
            </div>
          </section>

          {professionalItems.length > 0 && (
            <section style={{ padding: mode === 'mobile' ? '0 22px 22px' : '0 32px 32px' }}>
              <small style={{ color: form.primaryColor, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.13em' }}>Equipe</small>
              <div style={{ display: 'grid', gridTemplateColumns: mode === 'mobile' ? '1fr' : `repeat(${professionalItems.length}, minmax(0, 1fr))`, gap: 10, marginTop: 10 }}>
                {professionalItems.map((professional) => (
                  <div key={professional.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: profile.surface, borderRadius: profile.radius }}>
                    {professional.photoUrl && <img src={professional.photoUrl} alt={professional.name} style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />}
                    <div><strong style={{ display: 'block', fontSize: 12 }}>{professional.name}</strong><small style={{ color: profile.muted, fontFamily: 'Arial, sans-serif' }}>{professional.specialty}</small></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer style={{ padding: 20, background: form.secondaryColor || '#171311', color: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 10, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>{form.openingHours || 'Horário de funcionamento'}</span>
            <span>{form.address || 'Endereço do salão'}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function SiteSettings({ salon, services = [], professionals = [], reload, setPage }) {
  const [form, setForm] = useState(() => fromSalon(salon));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(fromSalon(salon)));
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('identity');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [saving, setSaving] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1060 : false);

  useEffect(() => {
    const next = fromSalon(salon);
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
  }, [salon]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1060);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== savedSnapshot, [form, savedSnapshot]);

  function patch(key, value) {
    setMessage('');
    setForm((current) => ({ ...current, [key]: value }));
  }

  function revert() {
    const next = fromSalon(salon);
    setForm(next);
    setMessage('Alterações não publicadas foram descartadas.');
  }

  async function save() {
    setSaving(true);
    setMessage('Publicando alterações...');
    try {
      const payload = { ...form, customDomain: normalizeDomain(form.customDomain) };
      await request('/admin/salon', { method: 'PUT', body: JSON.stringify(payload) });
      setForm(payload);
      setSavedSnapshot(JSON.stringify(payload));
      await reload();
      setMessage('Publicado com sucesso. A vitrine deste salão já foi atualizada.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível publicar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  if (!salon) return null;

  const panelStyle = { padding: 20, border: '1px solid var(--line)', borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--shadow)' };
  const tabButton = (active) => ({ display: 'flex', alignItems: 'center', gap: 9, width: '100%', minHeight: 44, padding: '0 14px', borderRadius: 14, color: active ? '#111827' : 'var(--muted)', background: active ? 'linear-gradient(135deg,var(--gold-2),var(--gold))' : 'transparent', fontWeight: 900, textAlign: 'left' });

  return (
    <main className="container" style={{ maxWidth: 1680 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <SectionTitle label="Site & Marca" title={`Editor visual • ${salon.name}`} text="Edite a identidade, acompanhe a prévia em tempo real e publique quando estiver satisfeito. Nada aqui altera outros salões." />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 900, color: dirty ? '#fbbf24' : '#34d399', background: dirty ? 'rgba(251,191,36,.12)' : 'rgba(52,211,153,.12)', border: `1px solid ${dirty ? 'rgba(251,191,36,.28)' : 'rgba(52,211,153,.28)'}` }}>{dirty ? '● Alterações não publicadas' : '● Site sincronizado'}</span>
          <button type="button" className="secondary" onClick={() => setPage('admin')}>Voltar ao painel</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(360px, .78fr) minmax(520px, 1.22fr)', gap: 22, alignItems: 'start' }}>
        <section style={{ ...panelStyle, display: 'grid', gridTemplateColumns: narrow ? '1fr' : '160px minmax(0,1fr)', gap: 18 }}>
          <aside style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            {TABS.map((tab) => <button key={tab.id} type="button" style={tabButton(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}><span>{tab.icon}</span><span>{tab.label}</span></button>)}
          </aside>

          <div style={{ minWidth: 0 }}>
            {activeTab === 'identity' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div><span className="eyebrow">Identidade</span><h2 style={{ margin: '4px 0 16px' }}>Marca do salão</h2></div>
              <ImageInput label="Logo" value={form.logoUrl} onChange={(value) => patch('logoUrl', value)} />
              <Input label="Nome do salão" value={form.name} onChange={(value) => patch('name', value)} required />
              <Textarea label="Apresentação" value={form.description} onChange={(value) => patch('description', value)} required />
            </div>}

            {activeTab === 'hero' && <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div><span className="eyebrow">Primeira impressão</span><h2 style={{ margin: '4px 0 16px' }}>Hero do site</h2></div>
              <ImageInput label="Imagem principal / Hero" value={form.heroImage} onChange={(value) => patch('heroImage', value)} />
              <Input label="Título principal" value={form.heroTitle} onChange={(value) => patch('heroTitle', value)} />
              <p className="panel-help">Use uma frase curta e forte. Ex.: “Sua beleza, sua melhor versão”.</p>
            </div>}

            {activeTab === 'contact' && <div className="form-grid" style={{ gridTemplateColumns: narrow ? '1fr' : 'repeat(2,minmax(0,1fr))' }}>
              <div className="full"><span className="eyebrow">Informações públicas</span><h2 style={{ margin: '4px 0 16px' }}>Contato & atendimento</h2></div>
              <Input label="WhatsApp" value={form.whatsapp} onChange={(value) => patch('whatsapp', value)} required />
              <Input label="Telefone" value={form.phone} onChange={(value) => patch('phone', value)} required />
              <Input label="Instagram" value={form.instagram} onChange={(value) => patch('instagram', value)} />
              <Input label="Horário de funcionamento" value={form.openingHours} onChange={(value) => patch('openingHours', value)} required />
              <div className="full"><Input label="Endereço" value={form.address} onChange={(value) => patch('address', value)} required /></div>
            </div>}

            {activeTab === 'appearance' && <div style={{ display: 'grid', gap: 18 }}>
              <div><span className="eyebrow">Aparência</span><h2 style={{ margin: '4px 0 8px' }}>Template visual</h2><p className="panel-help">Escolha a base que mais combina com a marca. A prévia muda imediatamente.</p></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                {TEMPLATES.map((template) => {
                  const selected = form.siteTemplate === template.id;
                  return <button key={template.id} type="button" onClick={() => patch('siteTemplate', template.id)} style={{ padding: 13, borderRadius: 16, textAlign: 'left', color: 'var(--text)', background: selected ? 'rgba(214,179,95,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${selected ? 'rgba(214,179,95,.55)' : 'var(--line)'}` }}>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>{template.sample.map((color) => <span key={color} style={{ width: 18, height: 18, borderRadius: 99, background: color, border: '1px solid rgba(255,255,255,.18)' }} />)}</div>
                    <strong style={{ display: 'block' }}>{template.name}</strong><small style={{ color: 'var(--muted)' }}>{template.description}</small>
                  </button>;
                })}
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                <Input label="Cor principal" type="color" value={form.primaryColor} onChange={(value) => patch('primaryColor', value)} />
                <Input label="Cor secundária" type="color" value={form.secondaryColor} onChange={(value) => patch('secondaryColor', value)} />
                <Input label="Destaque" type="color" value={form.accentColor} onChange={(value) => patch('accentColor', value)} />
              </div>
            </div>}

            {activeTab === 'domain' && <div style={{ display: 'grid', gap: 18 }}>
              <div><span className="eyebrow">Publicação</span><h2 style={{ margin: '4px 0 8px' }}>Endereço do site</h2><p className="panel-help">O domínio próprio é opcional. Sem ele, você pode homologar o salão pelo slug.</p></div>
              <Input label="Domínio próprio" value={form.customDomain} onChange={(value) => patch('customDomain', value)} />
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,.045)', border: '1px solid var(--line)' }}>
                <small style={{ color: 'var(--muted)' }}>Slug do tenant</small>
                <strong style={{ display: 'block', marginTop: 4 }}>{salon.slug}</strong>
                <code style={{ display: 'block', marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,.22)', color: 'var(--gold-2)', overflowWrap: 'anywhere' }}>?salon={salon.slug}</code>
              </div>
              <p className="panel-help">Para domínio próprio, ainda é necessário apontar o DNS do domínio para a hospedagem configurada. O campo acima apenas vincula o domínio ao tenant correto.</p>
            </div>}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              <button type="button" className="primary" disabled={saving || !dirty} onClick={save}>{saving ? 'Publicando...' : 'Salvar e publicar'}</button>
              <button type="button" className="secondary" disabled={saving || !dirty} onClick={revert}>Reverter</button>
              {message && <p className="feedback full" style={{ marginTop: 4 }}>{message}</p>}
            </div>
          </div>
        </section>

        <section style={{ ...panelStyle, position: narrow ? 'static' : 'sticky', top: 92 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div><span className="eyebrow">Prévia ao vivo</span><h2 style={{ margin: '3px 0 0' }}>Como o cliente verá</h2></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={previewMode === 'desktop' ? 'primary' : 'secondary'} onClick={() => setPreviewMode('desktop')}>▰ Desktop</button>
              <button type="button" className={previewMode === 'mobile' ? 'primary' : 'secondary'} onClick={() => setPreviewMode('mobile')}>▯ Mobile</button>
            </div>
          </div>
          <Preview form={form} services={services} professionals={professionals} mode={previewMode} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" onClick={() => setPage('public')}>Ver site publicado</button>
            <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 12 }}>{dirty ? 'A prévia inclui alterações ainda não publicadas.' : 'A prévia está igual ao site publicado.'}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
