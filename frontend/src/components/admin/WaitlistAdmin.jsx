import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

function pad(value) { return String(value).padStart(2, '0'); }
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}
function statusLabel(status) {
  return ({ WAITING: 'Aguardando', OFFERED: 'Oferta enviada', BOOKED: 'Agendado', CANCELLED: 'Cancelado' })[status] || status;
}

export function WaitlistAdmin({ setPage }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('ACTIVE');
  const [scanDate, setScanDate] = useState(todayIso());
  const [scanning, setScanning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setEntries(await request('/admin/appointments/waitlist'));
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar a lista de espera.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => entries.filter((entry) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return ['WAITING', 'OFFERED'].includes(entry.status);
    return entry.status === filter;
  }), [entries, filter]);

  const stats = useMemo(() => ({
    waiting: entries.filter((item) => item.status === 'WAITING').length,
    offered: entries.filter((item) => item.status === 'OFFERED').length,
    booked: entries.filter((item) => item.status === 'BOOKED').length,
    today: entries.filter((item) => item.desiredDate === todayIso() && ['WAITING', 'OFFERED'].includes(item.status)).length
  }), [entries]);

  async function updateEntry(id, data) {
    setMessage('Atualizando fila…');
    try {
      await request(`/admin/appointments/waitlist/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      setMessage('Lista de espera atualizada.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar a fila.');
    }
  }

  async function scan() {
    setScanning(true);
    setMessage('Procurando o melhor encaixe disponível…');
    try {
      const result = await request('/admin/appointments/waitlist/scan', {
        method: 'POST', body: JSON.stringify({ date: scanDate })
      });
      setMessage(result.offered
        ? 'Oferta enviada pelo WhatsApp para o cliente com melhor encaixe.'
        : (result.message || 'Nenhum encaixe compatível encontrado.'));
      await load();
    } catch (error) {
      setMessage(error.message || 'Não foi possível processar a fila.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="wait-admin-page">
      <div className="wait-admin-shell">
        <header className="wait-admin-header">
          <div>
            <span className="eyebrow">Agenda inteligente</span>
            <h1>Lista de Espera</h1>
            <p>Clientes sem horário entram na fila e são cruzados automaticamente com cancelamentos, duração, jornada e preferência de profissional.</p>
          </div>
          <div className="wait-admin-actions">
            <button className="secondary" onClick={() => setPage('operational-agenda')}>Agenda Visual</button>
            <button className="secondary" onClick={() => setPage('smart-fit')}>Encaixe</button>
            <button className="secondary" onClick={() => setPage('admin')}>Painel</button>
          </div>
        </header>

        <section className="wait-stats">
          <article><span>Aguardando</span><strong>{stats.waiting}</strong><small>na fila</small></article>
          <article><span>Ofertas enviadas</span><strong>{stats.offered}</strong><small>aguardando resposta</small></article>
          <article><span>Convertidos</span><strong>{stats.booked}</strong><small>viraram agendamento</small></article>
          <article><span>Hoje</span><strong>{stats.today}</strong><small>pedidos ativos</small></article>
        </section>

        <section className="wait-scan-card">
          <div><strong>Varredura manual</strong><span>Útil para testar ou reprocessar um dia depois de mudanças na agenda.</span></div>
          <label><span>Data</span><input type="date" value={scanDate} onChange={(event) => setScanDate(event.target.value)} /></label>
          <button className="primary" onClick={scan} disabled={scanning}>{scanning ? 'Procurando…' : 'Procurar encaixe agora'}</button>
        </section>

        <section className="wait-toolbar">
          {[
            ['ACTIVE', 'Ativos'], ['WAITING', 'Aguardando'], ['OFFERED', 'Ofertados'], ['BOOKED', 'Agendados'], ['CANCELLED', 'Cancelados'], ['ALL', 'Todos']
          ].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
        </section>

        {message && <p className="feedback">{message}</p>}
        {loading ? <p className="wait-empty">Carregando fila…</p> : visible.length ? (
          <section className="wait-list">
            {visible.map((entry) => (
              <article className={`wait-card status-${entry.status.toLowerCase()}`} key={entry.id}>
                <div className="wait-card-main">
                  <div className="wait-person">
                    <strong>{entry.clientName}</strong>
                    <span>{entry.clientPhone}</span>
                  </div>
                  <span className="wait-status">{statusLabel(entry.status)}</span>
                </div>
                <div className="wait-details">
                  <span><small>Serviço</small><strong>{entry.service?.name || '—'}</strong></span>
                  <span><small>Data</small><strong>{dateLabel(entry.desiredDate)}</strong></span>
                  <span><small>Faixa</small><strong>{entry.earliestTime}–{entry.latestTime}</strong></span>
                  <span><small>Profissional</small><strong>{entry.professional?.name || 'Qualquer'}</strong></span>
                </div>
                {entry.status === 'OFFERED' && entry.offeredStartTime && (
                  <div className="wait-offer"><strong>Oferta ativa</strong><span>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.offeredStartTime))} · expira {entry.offeredUntil ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.offeredUntil)) : ''}</span></div>
                )}
                <div className="wait-card-footer">
                  <span className="wait-priority">Prioridade <strong>{entry.priority}</strong></span>
                  <div>
                    {entry.status === 'WAITING' && <button onClick={() => updateEntry(entry.id, { priority: Math.max(-5, entry.priority - 1) })}>− prioridade</button>}
                    {entry.status === 'WAITING' && <button onClick={() => updateEntry(entry.id, { priority: Math.min(10, entry.priority + 1) })}>+ prioridade</button>}
                    {['WAITING', 'OFFERED'].includes(entry.status) && <button className="danger" onClick={() => updateEntry(entry.id, { status: 'CANCELLED' })}>Remover da fila</button>}
                    {entry.status === 'CANCELLED' && <button onClick={() => updateEntry(entry.id, { status: 'WAITING' })}>Reativar</button>}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : <p className="wait-empty">Nenhum cliente neste filtro.</p>}
      </div>

      <style>{`
        .wait-admin-page{min-height:75vh;padding:38px 18px 80px;background:radial-gradient(circle at 8% 0%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 30%)}.wait-admin-shell{max-width:1180px;margin:0 auto;display:grid;gap:18px}.wait-admin-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.wait-admin-header>div:first-child{max-width:780px}.wait-admin-header h1{font-size:clamp(2rem,4vw,3.4rem);margin:6px 0 8px;letter-spacing:-.04em}.wait-admin-header p{margin:0;color:var(--muted)}.wait-admin-actions{display:flex;gap:8px;flex-wrap:wrap}.wait-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.wait-stats article{display:grid;gap:3px;padding:14px 16px;border:1px solid var(--border);border-radius:17px;background:var(--surface)}.wait-stats span,.wait-stats small{color:var(--muted)}.wait-stats strong{font-size:1.25rem}.wait-scan-card{display:grid;grid-template-columns:1fr 180px auto;gap:12px;align-items:end;padding:16px;border:1px solid color-mix(in srgb,var(--gold) 38%,var(--border));border-radius:18px;background:color-mix(in srgb,var(--gold) 7%,var(--surface))}.wait-scan-card>div{display:grid;gap:3px}.wait-scan-card>div span{color:var(--muted)}.wait-scan-card label{display:grid;gap:5px;color:var(--muted);font-size:.76rem}.wait-scan-card input{height:42px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);padding:0 10px}.wait-toolbar{display:flex;gap:7px;overflow:auto;padding-bottom:2px}.wait-toolbar button{white-space:nowrap;border:1px solid var(--border);background:var(--card);color:var(--muted);border-radius:999px;padding:8px 12px;font-weight:800}.wait-toolbar button.active{border-color:var(--gold);color:var(--text);background:color-mix(in srgb,var(--gold) 10%,var(--card))}.wait-list{display:grid;gap:10px}.wait-card{display:grid;gap:13px;border:1px solid var(--border);border-left:4px solid var(--border);border-radius:19px;background:var(--surface);padding:16px}.wait-card.status-waiting{border-left-color:var(--gold)}.wait-card.status-offered{border-left-color:#58a6ff}.wait-card.status-booked{border-left-color:#3fb950}.wait-card.status-cancelled{opacity:.65}.wait-card-main,.wait-card-footer{display:flex;justify-content:space-between;gap:12px;align-items:center}.wait-person{display:grid;gap:2px}.wait-person span{color:var(--muted);font-size:.84rem}.wait-status{font-size:.72rem;font-weight:900;padding:6px 9px;border:1px solid var(--border);border-radius:999px;background:var(--card)}.wait-details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.wait-details span{display:grid;gap:3px;padding:9px 10px;border-radius:12px;background:var(--card)}.wait-details small{color:var(--muted);font-size:.68rem}.wait-details strong{font-size:.82rem}.wait-offer{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#58a6ff 9%,var(--card));border:1px solid color-mix(in srgb,#58a6ff 30%,var(--border))}.wait-offer span{color:var(--muted)}.wait-priority{color:var(--muted);font-size:.8rem}.wait-card-footer>div{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.wait-card-footer button{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:10px;padding:7px 9px;font-weight:800;font-size:.74rem}.wait-card-footer button.danger{color:#f85149;border-color:color-mix(in srgb,#f85149 40%,var(--border))}.wait-empty{padding:28px;border:1px dashed var(--border);border-radius:18px;text-align:center;color:var(--muted)}
        @media(max-width:800px){.wait-admin-header{display:grid}.wait-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.wait-scan-card{grid-template-columns:1fr 1fr}.wait-scan-card>button{grid-column:1/-1}.wait-details{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:520px){.wait-admin-page{padding:24px 9px 60px}.wait-admin-actions>*{flex:1}.wait-scan-card{grid-template-columns:1fr}.wait-scan-card>button{grid-column:auto}.wait-card-main,.wait-card-footer,.wait-offer{align-items:flex-start;display:grid}.wait-details{grid-template-columns:1fr 1fr}.wait-card-footer>div{justify-content:flex-start}}
      `}</style>
    </main>
  );
}
