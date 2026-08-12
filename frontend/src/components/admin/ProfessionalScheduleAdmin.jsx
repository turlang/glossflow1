import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

const DAYS = [
  ['mon', 'Segunda'], ['tue', 'Terça'], ['wed', 'Quarta'], ['thu', 'Quinta'],
  ['fri', 'Sexta'], ['sat', 'Sábado'], ['sun', 'Domingo']
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}


function formatBlock(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
}

function typeLabel(type) {
  return type === 'VACATION' ? 'Férias' : type === 'TIME_OFF' ? 'Ausência' : 'Bloqueio';
}

function ScheduleEditor({ professional, defaultSchedule, reload, onBack, onServices }) {
  const initial = professional.workScheduleConfigured && professional.weeklySchedule
    ? professional.weeklySchedule
    : defaultSchedule;
  const [schedule, setSchedule] = useState(() => clone(initial));
  const [configured, setConfigured] = useState(Boolean(professional.workScheduleConfigured));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [block, setBlock] = useState({ type: 'BLOCK', startTime: '', endTime: '', reason: '' });
  const [savingBlock, setSavingBlock] = useState(false);

  function updateDay(key, patch) {
    setSchedule((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setConfigured(true);
    setMessage('');
  }

  function addBreak(key) {
    const current = schedule[key];
    if ((current.breaks || []).length >= 4) return;
    updateDay(key, { breaks: [...(current.breaks || []), { start: '12:00', end: '13:00' }] });
  }

  function updateBreak(key, index, patch) {
    const breaks = [...(schedule[key].breaks || [])];
    breaks[index] = { ...breaks[index], ...patch };
    updateDay(key, { breaks });
  }

  function removeBreak(key, index) {
    updateDay(key, { breaks: (schedule[key].breaks || []).filter((_, itemIndex) => itemIndex !== index) });
  }

  async function saveSchedule() {
    setSaving(true);
    setMessage('');
    try {
      await request(`/admin/appointments/team-schedules/${professional.id}`, {
        method: 'PUT',
        body: JSON.stringify({ workScheduleConfigured: configured, weeklySchedule: schedule })
      });
      setMessage(configured ? 'Jornada salva. A agenda já recalculou as vagas.' : 'Profissional voltou a usar o horário geral do salão.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function useSalonHours() {
    setSchedule(clone(defaultSchedule));
    setConfigured(false);
    setSaving(true);
    setMessage('');
    try {
      await request(`/admin/appointments/team-schedules/${professional.id}`, {
        method: 'PUT',
        body: JSON.stringify({ workScheduleConfigured: false, weeklySchedule: defaultSchedule })
      });
      setMessage('Horário geral do salão restaurado para este profissional.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function addTimeBlock(event) {
    event.preventDefault();
    if (!block.startTime || !block.endTime) return;
    setSavingBlock(true);
    setMessage('');
    try {
      await request(`/admin/appointments/team-schedules/${professional.id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          type: block.type,
          startTime: new Date(block.startTime).toISOString(),
          endTime: new Date(block.endTime).toISOString(),
          reason: block.reason
        })
      });
      setBlock({ type: 'BLOCK', startTime: '', endTime: '', reason: '' });
      setMessage('Bloqueio criado. O período já deixou de aparecer como disponível.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingBlock(false);
    }
  }

  async function removeTimeBlock(blockId) {
    setMessage('');
    try {
      await request(`/admin/appointments/team-schedules/${professional.id}/blocks/${blockId}`, { method: 'DELETE' });
      setMessage('Bloqueio removido e disponibilidade recalculada.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <header className="schedule-header">
        <div className="schedule-person">
          {professional.photoUrl ? <img src={professional.photoUrl} alt="" /> : <span>{professional.name.charAt(0)}</span>}
          <div><span className="eyebrow">Jornada individual</span><h1>{professional.name}</h1><p>{professional.specialty}</p></div>
        </div>
        <div className="schedule-actions">
          <button className="secondary" type="button" onClick={onServices}>Equipe & Serviços</button>
          <button className="secondary" type="button" onClick={onBack}>Trocar profissional</button>
        </div>
      </header>

      <section className="schedule-status">
        <div><strong>{configured ? 'Jornada personalizada ativa' : 'Usando horário geral do salão'}</strong><span>{configured ? 'As vagas seguem os horários abaixo.' : 'Compatibilidade automática com os cadastros antigos.'}</span></div>
        <button className="ghost-button" type="button" onClick={useSalonHours} disabled={!configured || saving}>Usar horário geral</button>
      </section>

      <section className="schedule-card">
        <div className="schedule-section-title"><div><span className="eyebrow">Semana padrão</span><h2>Quando trabalha</h2></div><p>Intervalos como almoço são removidos da capacidade disponível.</p></div>
        <div className="schedule-week">
          {DAYS.map(([key, label]) => {
            const day = schedule[key];
            return (
              <article className={`schedule-day-row ${day.enabled ? '' : 'is-off'}`} key={key}>
                <label className="schedule-day-toggle"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(key, { enabled: event.target.checked })} /><span><strong>{label}</strong><small>{day.enabled ? 'Trabalha' : 'Folga'}</small></span></label>
                <div className="schedule-hours">
                  <label>Entrada<input type="time" value={day.start} disabled={!day.enabled} onChange={(event) => updateDay(key, { start: event.target.value })} /></label>
                  <span>até</span>
                  <label>Saída<input type="time" value={day.end} disabled={!day.enabled} onChange={(event) => updateDay(key, { end: event.target.value })} /></label>
                </div>
                <div className="schedule-breaks">
                  {(day.breaks || []).map((item, index) => (
                    <div className="schedule-break" key={`${key}-${index}`}>
                      <span>Intervalo</span>
                      <input type="time" value={item.start} disabled={!day.enabled} onChange={(event) => updateBreak(key, index, { start: event.target.value })} />
                      <span>–</span>
                      <input type="time" value={item.end} disabled={!day.enabled} onChange={(event) => updateBreak(key, index, { end: event.target.value })} />
                      <button type="button" onClick={() => removeBreak(key, index)} aria-label="Remover intervalo">×</button>
                    </div>
                  ))}
                  {day.enabled && <button className="schedule-add-break" type="button" onClick={() => addBreak(key)}>+ intervalo</button>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="schedule-save-row"><span>{configured ? 'Alterações afetam site, IA e WhatsApp.' : 'Edite qualquer dia para ativar uma jornada personalizada.'}</span><button className="primary" type="button" onClick={saveSchedule} disabled={saving}>{saving ? 'Salvando…' : 'Salvar jornada'}</button></div>
      </section>

      <section className="schedule-card">
        <div className="schedule-section-title"><div><span className="eyebrow">Exceções</span><h2>Férias, ausências e bloqueios</h2></div><p>Use para consulta médica, compromisso, férias ou qualquer período indisponível.</p></div>
        <form className="schedule-block-form" onSubmit={addTimeBlock}>
          <label>Tipo<select value={block.type} onChange={(event) => setBlock({ ...block, type: event.target.value })}><option value="BLOCK">Bloqueio</option><option value="TIME_OFF">Ausência</option><option value="VACATION">Férias</option></select></label>
          <label>Início<input type="datetime-local" value={block.startTime} onChange={(event) => setBlock({ ...block, startTime: event.target.value })} required /></label>
          <label>Fim<input type="datetime-local" value={block.endTime} onChange={(event) => setBlock({ ...block, endTime: event.target.value })} required /></label>
          <label className="schedule-reason">Motivo<input value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Ex.: férias, consulta, treinamento" /></label>
          <button className="primary" type="submit" disabled={savingBlock}>{savingBlock ? 'Bloqueando…' : 'Bloquear período'}</button>
        </form>

        <div className="schedule-block-list">
          {(professional.timeBlocks || []).length === 0 && <p className="schedule-empty">Nenhum bloqueio cadastrado.</p>}
          {(professional.timeBlocks || []).map((item) => (
            <article key={item.id}>
              <div><strong>{typeLabel(item.type)}</strong><span>{formatBlock(item.startTime)} → {formatBlock(item.endTime)}</span><small>{item.reason || 'Sem observação'}</small></div>
              <button className="ghost-button" type="button" onClick={() => removeTimeBlock(item.id)}>Remover</button>
            </article>
          ))}
        </div>
      </section>

      {message && <p className="feedback schedule-feedback">{message}</p>}
    </>
  );
}

export function ProfessionalScheduleAdmin({ setPage }) {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await request('/admin/appointments/team-schedules');
      setData(result);
      if (selectedId && !result.professionals.some((item) => item.id === selectedId)) setSelectedId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selected = useMemo(() => data?.professionals?.find((item) => item.id === selectedId) || null, [data, selectedId]);

  return (
    <main className="schedule-page">
      <div className="schedule-shell">
        {!selected && (
          <>
            <header className="schedule-header">
              <div><span className="eyebrow">Agenda inteligente</span><h1>Jornada da equipe</h1><p>Defina quando cada profissional realmente pode receber clientes. O cálculo de vagas respeita entrada, saída, almoço, folgas, férias e bloqueios.</p></div>
              <div className="schedule-actions"><button className="secondary" type="button" onClick={() => setPage('professional-services')}>Equipe & Serviços</button><button className="secondary" type="button" onClick={() => setPage('admin')}>Painel</button></div>
            </header>

            <div className="schedule-callout"><strong>Capacidade por tempo, não por quantidade fixa</strong><span>Se um serviço dura 4 horas, o GlossFlow só considera uma vaga quando existe um bloco contínuo de 4 horas dentro da jornada real do profissional.</span></div>

            {loading && <p className="feedback">Carregando jornadas…</p>}
            {error && <p className="feedback error">{error}</p>}
            <div className="schedule-team-grid">
              {(data?.professionals || []).map((professional) => (
                <button type="button" key={professional.id} onClick={() => setSelectedId(professional.id)}>
                  {professional.photoUrl ? <img src={professional.photoUrl} alt="" /> : <span className="schedule-avatar">{professional.name.charAt(0)}</span>}
                  <span><strong>{professional.name}</strong><small>{professional.specialty}</small><em>{professional.workScheduleConfigured ? 'Jornada personalizada' : 'Horário geral do salão'}</em></span>
                  <b>›</b>
                </button>
              ))}
            </div>
          </>
        )}

        {selected && <ScheduleEditor key={`${selected.id}-${JSON.stringify(selected.weeklySchedule)}-${(selected.timeBlocks || []).length}`} professional={selected} defaultSchedule={data.defaultSchedule} reload={load} onBack={() => setSelectedId('')} onServices={() => setPage('professional-services')} />}
      </div>
    </main>
  );
}
