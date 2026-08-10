import React, { useMemo, useState } from 'react';
import { request } from '../../services/api';

function serviceLabel(service) {
  const duration = Number(service.durationMin || 0);
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const time = hours ? `${hours}h${minutes ? ` ${minutes}min` : ''}` : `${minutes}min`;
  return `${service.name} · ${time}`;
}

function CapabilityCard({ professional, services, reload }) {
  const initialAll = !professional.servicesConfigured;
  const [allServices, setAllServices] = useState(initialAll);
  const [selected, setSelected] = useState(() => new Set(professional.serviceIds || []));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedNames = useMemo(
    () => services.filter((service) => selected.has(service.id)).map((service) => service.name),
    [services, selected]
  );

  function toggleService(id) {
    setMessage('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!allServices && selected.size === 0) {
      setMessage('Selecione pelo menos um serviço ou marque “Atende todos”.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await request(`/admin/professionals/${professional.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: professional.name,
          specialty: professional.specialty,
          bio: professional.bio,
          photoUrl: professional.photoUrl || '',
          active: professional.active !== false,
          servicesConfigured: !allServices,
          serviceIds: allServices ? [] : [...selected]
        })
      });
      setMessage('Serviços atualizados. A agenda já está usando esta regra.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="capability-card">
      <div className="capability-person">
        {professional.photoUrl
          ? <img src={professional.photoUrl} alt="" />
          : <span>{professional.name?.charAt(0) || '?'}</span>}
        <div>
          <strong>{professional.name}</strong>
          <small>{professional.specialty}</small>
        </div>
      </div>

      <label className="capability-all">
        <input
          type="checkbox"
          checked={allServices}
          onChange={(event) => {
            setAllServices(event.target.checked);
            setMessage('');
          }}
        />
        <span><strong>Atende todos os serviços</strong><small>Compatível com o comportamento antigo do salão.</small></span>
      </label>

      {!allServices && (
        <div className="capability-services" role="group" aria-label={`Serviços atendidos por ${professional.name}`}>
          {services.map((service) => (
            <label key={service.id} className={selected.has(service.id) ? 'is-selected' : ''}>
              <input type="checkbox" checked={selected.has(service.id)} onChange={() => toggleService(service.id)} />
              <span><strong>{service.name}</strong><small>{serviceLabel(service)}</small></span>
            </label>
          ))}
        </div>
      )}

      <div className="capability-footer">
        <small>{allServices ? 'Todos os serviços ativos' : `${selectedNames.length} serviço(s) vinculado(s)`}</small>
        <button className="primary" type="button" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar vínculos'}</button>
      </div>
      {message && <p className="feedback">{message}</p>}
    </article>
  );
}

export function ProfessionalCapabilitiesAdmin({ salon, services, professionals, reload, setPage }) {
  return (
    <main className="capability-page">
      <section className="capability-shell">
        <header className="capability-header">
          <div>
            <span className="eyebrow">Equipe & serviços</span>
            <h1>Quem pode executar cada atendimento</h1>
            <p>Configure a capacidade técnica da equipe. A agenda pública e a disponibilidade passam a mostrar somente profissionais habilitados para o serviço escolhido.</p>
          </div>
          <div className="capability-header-actions">
            <button className="secondary" type="button" onClick={() => setPage('professional-schedule')}>Jornada da equipe</button>
            <button className="secondary" type="button" onClick={() => setPage('admin')}>Voltar ao painel</button>
          </div>
        </header>

        <div className="capability-callout">
          <strong>Regra de segurança da agenda</strong>
          <span>Profissionais ainda não configurados continuam atendendo todos os serviços. Ao salvar vínculos específicos, o GlossFlow bloqueia qualquer agendamento incompatível.</span>
        </div>

        {!services.length && <p className="feedback">Cadastre serviços antes de configurar a equipe.</p>}
        {!professionals.length && <p className="feedback">Cadastre profissionais antes de configurar os vínculos.</p>}

        <div className="capability-grid">
          {professionals.map((professional) => (
            <CapabilityCard key={`${professional.id}-${professional.updatedAt || ''}`} professional={professional} services={services} reload={reload} />
          ))}
        </div>
      </section>

      <style>{`
        .capability-page{min-height:70vh;padding:42px 20px 80px;background:radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 30%)}
        .capability-shell{max-width:1180px;margin:0 auto;display:grid;gap:22px}.capability-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.capability-header>div:first-child{max-width:760px}.capability-header h1{margin:7px 0 10px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.capability-header p{color:var(--muted);font-size:1.02rem}.capability-header-actions{display:flex;gap:9px;flex-wrap:wrap}.capability-callout{display:grid;gap:5px;padding:17px 20px;border:1px solid color-mix(in srgb,var(--gold) 45%,var(--border));border-radius:18px;background:color-mix(in srgb,var(--gold) 8%,var(--surface))}.capability-callout span{color:var(--muted)}
        .capability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.capability-card{border:1px solid var(--border);border-radius:24px;background:var(--surface);padding:22px;display:grid;gap:18px}.capability-person{display:flex;align-items:center;gap:12px}.capability-person img,.capability-person>span{width:48px;height:48px;border-radius:15px;object-fit:cover;display:grid;place-items:center;background:var(--gold);color:#111;font-weight:800}.capability-person div{display:grid}.capability-person small{color:var(--muted)}
        .capability-all{display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:16px;cursor:pointer}.capability-all input{margin-top:3px}.capability-all span{display:grid;gap:2px}.capability-all small{color:var(--muted)}.capability-services{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.capability-services label{display:flex;gap:9px;align-items:flex-start;padding:11px;border:1px solid var(--border);border-radius:14px;cursor:pointer;background:var(--surface-2)}.capability-services label.is-selected{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 9%,var(--surface))}.capability-services span{display:grid;gap:2px}.capability-services small{color:var(--muted);font-size:.78rem}.capability-footer{display:flex;align-items:center;justify-content:space-between;gap:14px}.capability-footer small{color:var(--muted)}
        @media(max-width:820px){.capability-header{display:grid}.capability-header-actions{width:100%}.capability-header-actions button{flex:1}.capability-grid{grid-template-columns:1fr}.capability-services{grid-template-columns:1fr}.capability-footer{align-items:stretch;flex-direction:column}.capability-footer .primary{width:100%}}
      `}</style>
    </main>
  );
}
