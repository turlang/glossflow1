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
    </main>
  );
}
