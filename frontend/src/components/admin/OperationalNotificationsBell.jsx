import React, { useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../../services/api';

function timeAgo(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function OperationalNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const data = await request('/admin/appointments/notifications');
      setItems(data.notifications || []);
      setUnread(Number(data.unread || 0));
    } catch {
      // A navegação administrativa não deve quebrar se a central estiver indisponível.
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function outside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const recent = useMemo(() => items.slice(0, 20), [items]);

  async function markRead(item) {
    if (!item.read) {
      try {
        await request(`/admin/appointments/notifications/${item.id}/read`, { method: 'PUT', body: '{}' });
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
        setUnread((current) => Math.max(0, current - 1));
      } catch {
        // Mantém a notificação visível mesmo se a marcação falhar.
      }
    }
  }

  async function markAll() {
    try {
      await request('/admin/appointments/notifications/read-all', { method: 'PUT', body: '{}' });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch {
      // Sem impacto na operação da agenda.
    }
  }

  return (
    <div className="op-notification" ref={wrapperRef}>
      <button
        className={`op-notification-bell ${unread ? 'has-unread' : ''}`}
        type="button"
        onClick={() => { setOpen((value) => !value); load({ quiet: true }); }}
        aria-label={`${unread} notificações não lidas`}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
      </button>

      {open && (
        <section className="op-notification-panel" aria-live="polite">
          <header>
            <div><strong>Notificações</strong><small>Agenda e clientes</small></div>
            {unread > 0 && <button type="button" onClick={markAll}>Marcar todas como lidas</button>}
          </header>

          <div className="op-notification-list">
            {loading && !recent.length ? <p className="op-notification-empty">Carregando…</p> : null}
            {!loading && !recent.length ? <p className="op-notification-empty">Nenhuma notificação operacional ainda.</p> : null}
            {recent.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`op-notification-item ${item.read ? '' : 'is-unread'} severity-${String(item.severity || 'INFO').toLowerCase()}`}
                onClick={() => markRead(item)}
              >
                <span className="op-notification-dot" />
                <span className="op-notification-copy">
                  <strong>{item.title}</strong>
                  <small>{item.message}</small>
                  <em>{timeAgo(item.createdAt)}</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .op-notification{position:relative;display:inline-flex;align-items:center}.op-notification-bell{position:relative;width:42px;height:42px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text);display:grid;place-items:center;cursor:pointer}.op-notification-bell.has-unread{border-color:color-mix(in srgb,var(--gold) 58%,var(--border));box-shadow:0 0 0 3px color-mix(in srgb,var(--gold) 12%,transparent)}.op-notification-bell>b{position:absolute;right:-6px;top:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:.65rem;display:grid;place-items:center;border:2px solid var(--bg)}
        .op-notification-panel{position:absolute;z-index:80;right:0;top:50px;width:min(390px,calc(100vw - 20px));max-height:70vh;overflow:hidden;border:1px solid var(--border);background:var(--surface);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.op-notification-panel>header{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:15px 16px;border-bottom:1px solid var(--border)}.op-notification-panel>header>div{display:grid}.op-notification-panel>header small{color:var(--muted)}.op-notification-panel>header button{border:0;background:transparent;color:var(--gold);font-size:.72rem;font-weight:800;cursor:pointer}.op-notification-list{max-height:56vh;overflow:auto;padding:8px}.op-notification-item{width:100%;display:grid;grid-template-columns:10px 1fr;gap:10px;text-align:left;padding:12px;border:0;border-radius:14px;background:transparent;color:var(--text);cursor:pointer}.op-notification-item:hover,.op-notification-item.is-unread{background:var(--card)}.op-notification-dot{width:8px;height:8px;border-radius:999px;background:var(--muted);margin-top:5px}.op-notification-item.is-unread .op-notification-dot{background:var(--gold);box-shadow:0 0 0 4px color-mix(in srgb,var(--gold) 15%,transparent)}.op-notification-item.severity-warning .op-notification-dot,.op-notification-item.severity-danger .op-notification-dot{background:#f59e0b}.op-notification-copy{display:grid;gap:4px}.op-notification-copy>strong{font-size:.87rem}.op-notification-copy>small{color:var(--muted);line-height:1.4}.op-notification-copy>em{font-style:normal;color:var(--muted);font-size:.68rem}.op-notification-empty{padding:24px 16px;text-align:center;color:var(--muted)}
        @media(max-width:720px){.op-notification-panel{position:fixed;right:10px;left:10px;top:74px;width:auto;max-height:74vh}.op-notification-list{max-height:62vh}}
      `}</style>
    </div>
  );
}
