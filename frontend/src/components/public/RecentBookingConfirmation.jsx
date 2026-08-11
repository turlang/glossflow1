import React, { useEffect, useState } from 'react';

const EVENT = 'glossflow:booking-confirmed';

function readLastBooking() {
  try {
    const raw = localStorage.getItem('glossflow.lastBooking');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function RecentBookingConfirmation() {
  const [booking, setBooking] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function show() {
      const current = readLastBooking();
      if (!current) return;
      setBooking(current);
      setOpen(true);
    }
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  if (!booking) return null;

  return (
    <>
      {!open && (
        <button className="recent-booking-chip" type="button" onClick={() => setOpen(true)}>
          ✓ Agendamento confirmado
        </button>
      )}
      {open && (
        <div className="recent-booking-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
          <section className="recent-booking-card">
            <button className="recent-booking-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            <span className="recent-booking-check">✓</span>
            <small>AGENDAMENTO REALIZADO COM SUCESSO</small>
            <h2>Seu horário está confirmado.</h2>
            <p className="recent-booking-protocol">Protocolo <strong>{booking.protocol || 'CONFIRMADO'}</strong></p>
            <p>O horário já foi gravado na agenda do salão.</p>

            {booking.clientNotification === 'SENT'
              ? <div className="recent-booking-notice success">✓ A solicitação de confirmação foi aceita pelo WhatsApp. A entrega ainda depende do provedor e pode levar alguns instantes.</div>
              : <div className="recent-booking-notice warning">⚠ O horário está confirmado, mas a solicitação de WhatsApp não foi aceita pelo provedor. Guarde este protocolo e o link abaixo.</div>}

            <div className="recent-booking-policy">
              <strong>Cancelamento</strong>
              <span>Você pode cancelar pelo site com pelo menos {booking.cancellationMinHours || 12} horas de antecedência.</span>
            </div>

            {booking.managementUrl && <a className="recent-booking-manage" href={booking.managementUrl}>Gerenciar ou cancelar meu agendamento</a>}
            <button className="recent-booking-ok" type="button" onClick={() => setOpen(false)}>Entendi, meu horário está confirmado</button>
          </section>
        </div>
      )}

      <style>{`
        .recent-booking-chip{position:fixed;right:18px;bottom:18px;z-index:150;padding:12px 16px;border:0;border-radius:999px;background:#22c55e;color:#07120a;font-weight:950;box-shadow:0 12px 40px rgba(0,0,0,.3);cursor:pointer}.recent-booking-backdrop{position:fixed;inset:0;z-index:300;background:rgba(3,6,15,.78);backdrop-filter:blur(8px);display:grid;place-items:center;padding:16px}.recent-booking-card{position:relative;width:min(560px,100%);display:grid;gap:13px;text-align:center;padding:32px 24px 24px;border:1px solid color-mix(in srgb,#22c55e 40%,var(--border));border-radius:28px;background:var(--surface);color:var(--text);box-shadow:0 30px 100px rgba(0,0,0,.5)}.recent-booking-close{position:absolute;right:13px;top:10px;width:38px;height:38px;border:0;border-radius:12px;background:var(--card);color:var(--text);font-size:1.5rem;cursor:pointer}.recent-booking-check{width:72px;height:72px;margin:0 auto;border-radius:999px;display:grid;place-items:center;background:#22c55e;color:#07120a;font-size:2rem;font-weight:1000;box-shadow:0 0 0 9px color-mix(in srgb,#22c55e 14%,transparent)}.recent-booking-card>small{color:#22c55e;font-weight:950;letter-spacing:.08em}.recent-booking-card h2{margin:0;font-size:clamp(1.8rem,5vw,2.6rem)}.recent-booking-card p{margin:0;color:var(--muted)}.recent-booking-protocol{padding:10px;border-radius:13px;background:var(--card)}.recent-booking-notice{padding:12px 14px;border-radius:14px;text-align:left;line-height:1.45}.recent-booking-notice.success{background:color-mix(in srgb,#22c55e 12%,var(--card));color:#22c55e}.recent-booking-notice.warning{background:color-mix(in srgb,#f59e0b 12%,var(--card));color:#f59e0b}.recent-booking-policy{display:grid;gap:4px;padding:13px 15px;border:1px solid var(--border);border-radius:14px;text-align:left}.recent-booking-policy span{color:var(--muted)}.recent-booking-manage,.recent-booking-ok{min-height:48px;border-radius:14px;display:grid;place-items:center;font-weight:900;text-decoration:none}.recent-booking-manage{background:var(--primary);color:#111}.recent-booking-ok{border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
      `}</style>
    </>
  );
}
