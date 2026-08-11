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
    </>
  );
}
