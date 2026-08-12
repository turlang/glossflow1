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
    </div>
  );
}
