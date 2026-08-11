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

      <style>{`
        .schedule-page{min-height:75vh;padding:42px 20px 80px;background:radial-gradient(circle at 8% 0%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 30%)}.schedule-shell{max-width:1180px;margin:0 auto;display:grid;gap:22px}.schedule-header{display:flex;justify-content:space-between;align-items:flex-start;gap:22px}.schedule-header>div:first-child{max-width:780px}.schedule-header h1{font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em;margin:7px 0 8px}.schedule-header p{color:var(--muted);margin:0}.schedule-actions{display:flex;gap:9px;flex-wrap:wrap}.schedule-callout,.schedule-status{border:1px solid color-mix(in srgb,var(--gold) 38%,var(--border));background:color-mix(in srgb,var(--gold) 7%,var(--surface));border-radius:18px;padding:17px 19px;display:flex;justify-content:space-between;gap:18px;align-items:center}.schedule-callout{display:grid;gap:5px}.schedule-callout span,.schedule-status span{color:var(--muted)}.schedule-status>div{display:grid;gap:4px}
        .schedule-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.schedule-team-grid>button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;text-align:left;padding:17px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text);cursor:pointer}.schedule-team-grid img,.schedule-avatar{width:52px;height:52px;border-radius:16px;object-fit:cover;display:grid;place-items:center;background:var(--gold);color:#111;font-weight:900}.schedule-team-grid button>span{display:grid;gap:2px}.schedule-team-grid small{color:var(--muted)}.schedule-team-grid em{font-size:.76rem;color:var(--gold);font-style:normal;font-weight:800;margin-top:3px}.schedule-team-grid b{font-size:1.6rem}.schedule-person{display:flex!important;align-items:center;gap:14px}.schedule-person img,.schedule-person>span{width:62px;height:62px;border-radius:18px;object-fit:cover;display:grid;place-items:center;background:var(--gold);color:#111;font-weight:900;font-size:1.25rem}.schedule-person h1{margin:3px 0}.schedule-person p{margin:0}
        .schedule-card{border:1px solid var(--border);background:var(--surface);border-radius:24px;padding:22px;display:grid;gap:18px}.schedule-section-title{display:flex;justify-content:space-between;gap:24px;align-items:end}.schedule-section-title h2{margin:4px 0 0}.schedule-section-title p{max-width:480px;color:var(--muted);margin:0;text-align:right}.schedule-week{display:grid;gap:9px}.schedule-day-row{display:grid;grid-template-columns:170px 260px 1fr;gap:16px;align-items:center;padding:13px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}.schedule-day-row.is-off{opacity:.62}.schedule-day-toggle{display:flex;align-items:center;gap:10px}.schedule-day-toggle span{display:grid}.schedule-day-toggle small{color:var(--muted)}.schedule-hours{display:flex;align-items:end;gap:8px}.schedule-hours label,.schedule-block-form label{display:grid;gap:5px;font-size:.78rem;color:var(--muted);font-weight:800}.schedule-hours input,.schedule-block-form input,.schedule-block-form select,.schedule-break input{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:10px;padding:8px}.schedule-hours>span{padding-bottom:9px;color:var(--muted)}.schedule-breaks{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.schedule-break{display:flex;align-items:center;gap:5px;font-size:.72rem;color:var(--muted);background:var(--surface);padding:5px 7px;border-radius:10px}.schedule-break input{width:92px}.schedule-break button{border:0;background:transparent;color:var(--text);font-size:1.1rem;cursor:pointer}.schedule-add-break{border:1px dashed var(--border);background:transparent;color:var(--muted);border-radius:10px;padding:8px 10px;cursor:pointer}.schedule-save-row{display:flex;justify-content:space-between;align-items:center;gap:15px}.schedule-save-row span{color:var(--muted);font-size:.86rem}
        .schedule-block-form{display:grid;grid-template-columns:150px 1fr 1fr 1.4fr auto;gap:10px;align-items:end}.schedule-block-form button{height:42px}.schedule-block-list{display:grid;gap:9px}.schedule-block-list article{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}.schedule-block-list article>div{display:grid;gap:3px}.schedule-block-list span,.schedule-block-list small{color:var(--muted)}.schedule-empty{color:var(--muted);text-align:center;padding:14px}.schedule-feedback{max-width:720px}
        @media(max-width:900px){.schedule-day-row{grid-template-columns:1fr}.schedule-section-title{display:grid;align-items:start}.schedule-section-title p{text-align:left}.schedule-block-form{grid-template-columns:repeat(2,minmax(0,1fr))}.schedule-reason{grid-column:1/-1}.schedule-block-form button{grid-column:1/-1}.schedule-team-grid{grid-template-columns:1fr}}
        @media(max-width:650px){.schedule-page{padding:28px 10px 70px}.schedule-header{display:grid}.schedule-actions{width:100%}.schedule-actions button{flex:1}.schedule-card{padding:15px;border-radius:18px}.schedule-status{align-items:stretch;flex-direction:column}.schedule-hours{justify-content:flex-start}.schedule-break{width:100%;flex-wrap:wrap}.schedule-block-form{grid-template-columns:1fr}.schedule-reason,.schedule-block-form button{grid-column:auto}.schedule-save-row{align-items:stretch;flex-direction:column}.schedule-save-row button{width:100%}.schedule-block-list article{align-items:stretch;flex-direction:column}}
      `}</style>
    </main>
  );
}
