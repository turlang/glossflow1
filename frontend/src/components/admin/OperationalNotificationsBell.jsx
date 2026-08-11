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
    </div>
  );
}
