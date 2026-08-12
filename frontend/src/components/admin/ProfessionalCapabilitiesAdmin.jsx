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

export function ProfessionalCapabilitiesAdmin({ services, professionals, reload, setPage }) {
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
    </main>
  );
}
