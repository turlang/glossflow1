import React, { useState } from 'react';
import { request } from '../../services/api';
import { Input, Textarea } from '../ui/Forms.jsx';

export function PublicWaitlistForm({ service, date, professionalId = '', professionalName = '', salon }) {
  const [form, setForm] = useState({
    clientName: '', clientPhone: '', clientEmail: '', earliestTime: '09:00', latestTime: '19:00', notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!service?.id || !date) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await request('/appointments/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          serviceId: service.id,
          professionalId: professionalId || '',
          desiredDate: date
        })
      });
      setSuccess(true);
      setMessage(result.message || 'Você entrou na lista de espera.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível entrar na lista de espera.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="waitlist-success" aria-live="polite">
        <span>✓</span>
        <div>
          <strong>Você está na lista de espera</strong>
          <p>{message} Se surgir uma vaga compatível, o {salon?.name || 'salão'} poderá avisar você pelo WhatsApp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist-public-card">
      <div className="waitlist-public-head">
        <span className="waitlist-icon">⏳</span>
        <div>
          <strong>Esse dia está sem encaixe disponível</strong>
          <p>Entre na lista de espera. O GlossFlow cruza sua preferência com cancelamentos e novos espaços livres.</p>
        </div>
      </div>

      <div className="waitlist-context">
        <span><small>Serviço</small><strong>{service?.name}</strong></span>
        <span><small>Data</small><strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00`))}</strong></span>
        <span><small>Profissional</small><strong>{professionalName || 'Qualquer profissional habilitado'}</strong></span>
      </div>

      <form className="waitlist-public-form" onSubmit={submit}>
        <div className="waitlist-time-grid">
          <label><span>Posso a partir de</span><input type="time" value={form.earliestTime} onChange={(event) => setForm({ ...form, earliestTime: event.target.value })} required /></label>
          <label><span>Até</span><input type="time" value={form.latestTime} onChange={(event) => setForm({ ...form, latestTime: event.target.value })} required /></label>
        </div>
        <div className="waitlist-contact-grid">
          <Input label="Nome" value={form.clientName} onChange={(clientName) => setForm({ ...form, clientName })} required />
          <Input label="WhatsApp" value={form.clientPhone} onChange={(clientPhone) => setForm({ ...form, clientPhone })} required />
          <Input label="E-mail opcional" type="email" value={form.clientEmail} onChange={(clientEmail) => setForm({ ...form, clientEmail })} />
        </div>
        <Textarea label="Observações opcionais" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        {message && <p className="feedback">{message}</p>}
        <button className="primary full" type="submit" disabled={loading}>{loading ? 'Entrando na fila…' : 'Entrar na lista de espera'}</button>
      </form>

      <style>{`
        .waitlist-public-card{display:grid;gap:16px;border:1px solid color-mix(in srgb,var(--primary) 38%,var(--border));background:color-mix(in srgb,var(--primary) 7%,var(--card));border-radius:20px;padding:18px}.waitlist-public-head{display:flex;gap:12px;align-items:flex-start}.waitlist-public-head strong{font-size:1.05rem}.waitlist-public-head p{margin:4px 0 0;color:var(--muted)}.waitlist-icon{display:grid;place-items:center;width:40px;height:40px;min-width:40px;border-radius:13px;background:color-mix(in srgb,var(--primary) 18%,var(--surface));font-size:1.15rem}.waitlist-context{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.waitlist-context span{display:grid;gap:3px;padding:10px 12px;border:1px solid var(--border);background:var(--surface);border-radius:13px}.waitlist-context small{color:var(--muted)}.waitlist-public-form{display:grid;gap:12px}.waitlist-time-grid,.waitlist-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.waitlist-contact-grid>*:last-child{grid-column:1/-1}.waitlist-time-grid label{display:grid;gap:5px;color:var(--muted);font-size:.78rem}.waitlist-time-grid input{height:42px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);padding:0 10px}.waitlist-success{display:flex;gap:13px;align-items:center;padding:18px;border:1px solid color-mix(in srgb,#3fb950 42%,var(--border));background:color-mix(in srgb,#3fb950 8%,var(--surface));border-radius:18px}.waitlist-success>span{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#3fb950;color:#07150a;font-weight:1000}.waitlist-success p{margin:4px 0 0;color:var(--muted)}
        @media(max-width:640px){.waitlist-context{grid-template-columns:1fr}.waitlist-time-grid,.waitlist-contact-grid{grid-template-columns:1fr}.waitlist-contact-grid>*:last-child{grid-column:auto}}
      `}</style>
    </div>
  );
}
