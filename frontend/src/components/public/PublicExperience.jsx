import React, { useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { SectionTitle, Input, Select, Textarea } from '../ui/Forms.jsx';

/**
 * Experiência pública do GlossFlow: vitrine, agendamento e login.
 * Separar esta camada do painel admin reduz acoplamento e facilita evolução.
 */

export function Header({ page, setPage, isAuthenticated, theme, toggleTheme }) {
  return (
    <header className="header">
      <button className="brand" onClick={() => setPage('public')} aria-label="Ir para a vitrine">
        <span className="brand-mark">G</span>
        <span>GlossFlow</span>
      </button>

      <nav className="nav">
        <button className={page === 'public' ? 'active' : ''} onClick={() => setPage('public')}>Vitrine</button>
        <button className={page === 'booking' ? 'active' : ''} onClick={() => setPage('booking')}>Agendar</button>
        <button className={page === 'commercial' ? 'active' : ''} onClick={() => setPage('commercial')}>SaaS</button>
        <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage(isAuthenticated ? 'admin' : 'login')}>Admin</button>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Alternar tema visual">{theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}</button>
      </nav>
    </header>
  );
}

export function PublicShowcase({ salon, services, professionals, portfolio, setPage }) {
  return (
    <main>
      <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(14,12,23,.92), rgba(14,12,23,.55)), url(${salon.heroImage})` }}>
        <div className="hero-content">
          <span className="eyebrow">Vitrine pública do salão</span>
          <h1>{salon.name}</h1>
          <p>{salon.description}</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setPage('booking')}>Agendar agora</button>
            <a className="secondary" href={`https://wa.me/${salon.whatsapp}`} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
          </div>
          <div className="hero-meta">
            <span>{salon.openingHours}</span>
            <span>{salon.address}</span>
          </div>
        </div>
      </section>

      <section className="container section-grid">
        <SectionTitle label="Serviços" title="Escolha o procedimento ideal" text="Preços e duração são cadastrados pelo administrador, sem necessidade de alterar código." />
        <div className="cards three">
          {services.map((service) => (
            <article className="card media-card" key={service.id}>
              {service.imageUrl && <img className="card-image" src={service.imageUrl} alt={service.name} />}
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <div className="card-footer"><strong>{currency(service.price)}</strong><span>{service.durationMin} min</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-grid">
        <SectionTitle label="Portfólio" title="Resultados reais para inspirar clientes" text="A vitrine aumenta confiança, mostra autoridade visual e ajuda na conversão do agendamento." />
        <div className="portfolio-grid">
          {portfolio.map((item) => (
            <article className="portfolio-card" key={item.id}>
              <img src={item.imageUrl} alt={item.title} />
              <div><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-grid">
        <SectionTitle label="Equipe" title="Profissionais do salão" text="Cada profissional pode ter especialidade, biografia e foto para fortalecer a decisão do cliente." />
        <div className="cards two">
          {professionals.map((professional) => (
            <article className="profile-card" key={professional.id}>
              <img src={professional.photoUrl || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=900&auto=format&fit=crop'} alt={professional.name} />
              <div><h3>{professional.name}</h3><strong>{professional.specialty}</strong><p>{professional.bio}</p></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function BookingPage({ services, professionals, onCreated }) {
  const [form, setForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', serviceId: '', professionalId: '', startTime: '', notes: '' });
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      await request('/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...form, startTime: new Date(form.startTime).toISOString() })
      });
      setMessage('Agendamento criado com sucesso. O salão já pode visualizar no painel administrativo.');
      setForm({ clientName: '', clientPhone: '', clientEmail: '', serviceId: '', professionalId: '', startTime: '', notes: '' });
      onCreated();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main className="container compact">
      <SectionTitle label="Agendamento" title="Reserve seu horário" text="O cliente escolhe serviço, profissional, data e horário sem depender de atendimento manual." />
      <form className="form-card" onSubmit={submit}>
        <Input label="Nome do cliente" value={form.clientName} onChange={(clientName) => setForm({ ...form, clientName })} required />
        <Input label="WhatsApp" value={form.clientPhone} onChange={(clientPhone) => setForm({ ...form, clientPhone })} required />
        <Input label="E-mail opcional" type="email" value={form.clientEmail} onChange={(clientEmail) => setForm({ ...form, clientEmail })} />
        <Select label="Serviço" value={form.serviceId} onChange={(serviceId) => setForm({ ...form, serviceId })} options={services.map(s => ({ value: s.id, label: `${s.name} - ${currency(s.price)}` }))} required />
        <Select label="Profissional" value={form.professionalId} onChange={(professionalId) => setForm({ ...form, professionalId })} options={professionals.map(p => ({ value: p.id, label: `${p.name} - ${p.specialty}` }))} required />
        <Input label="Data e horário" type="datetime-local" value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} required />
        <Textarea label="Observações" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        <button className="primary full" type="submit">Confirmar agendamento</button>
        {message && <p className="feedback">{message}</p>}
      </form>
    </main>
  );
}

export function LoginPage({ setPage, onLogin }) {
  const [email, setEmail] = useState('admin@glossflow.com');
  const [password, setPassword] = useState('123456');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('glossflow.token', data.token);
      if (data.refreshToken) localStorage.setItem('glossflow.refreshToken', data.refreshToken);
      onLogin(data.token);
      setPage('admin');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main className="container compact">
      <SectionTitle label="Admin" title="Acesso administrativo" text="Entre para cadastrar serviços, profissionais e trabalhos da vitrine." />
      <form className="form-card" onSubmit={submit}>
        <Input label="E-mail" type="email" value={email} onChange={setEmail} required />
        <Input label="Senha" type="password" value={password} onChange={setPassword} required />
        <button className="primary full" type="submit">Entrar no painel</button>
        {message && <p className="feedback error">{message}</p>}
      </form>
    </main>
  );
}
