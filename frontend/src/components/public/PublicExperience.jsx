import React, { useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { SectionTitle, Input } from '../ui/Forms.jsx';
import { PublicBookingCalendar } from './PublicBookingCalendar.jsx';

function tenantStyle(salon) {
  if (!salon) return undefined;
  return {
    '--gold': salon.primaryColor || '#C49A6C',
    '--gold-2': salon.accentColor || '#F7F1EA',
    '--primary': salon.primaryColor || '#C49A6C',
    '--primary-2': salon.secondaryColor || '#171311'
  };
}

/**
 * A experiência pública é white-label: o cliente final vê a marca do salão.
 * GlossFlow continua aparecendo apenas no backoffice/login da plataforma.
 */
export function Header({ page, setPage, isAuthenticated, theme, toggleTheme, salon }) {
  const backoffice = ['admin', 'login', 'commercial', 'agent-test', 'professional-services'].includes(page);
  const brandName = backoffice ? 'GlossFlow' : (salon?.name || 'Salão');
  const initial = brandName.trim().charAt(0).toUpperCase() || 'G';

  return (
    <header className="header" style={backoffice ? undefined : tenantStyle(salon)}>
      <button className="brand" onClick={() => setPage(backoffice && isAuthenticated ? 'admin' : 'public')} aria-label="Ir para o início">
        {salon?.logoUrl && !backoffice
          ? <img src={salon.logoUrl} alt={brandName} style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 14 }} />
          : <span className="brand-mark">{initial}</span>}
        <span>{brandName}</span>
      </button>

      <nav className="nav">
        {backoffice ? (
          <>
            <button onClick={() => setPage('public')}>Ver site</button>
            {isAuthenticated && <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')}>Painel</button>}
            {isAuthenticated && <button className={page === 'professional-services' ? 'active' : ''} onClick={() => setPage('professional-services')}>Equipe & Serviços</button>}
            {isAuthenticated && <button className={page === 'agent-test' ? 'active' : ''} onClick={() => setPage('agent-test')}>Testar IA</button>}
          </>
        ) : (
          <>
            <button className={page === 'public' ? 'active' : ''} onClick={() => setPage('public')}>Início</button>
            <button className={page === 'booking' ? 'active' : ''} onClick={() => setPage('booking')}>Agendar</button>
            {!isAuthenticated
              ? <button className="nav-admin-access" type="button" onClick={() => setPage('login')}>Entrar</button>
              : <button className="nav-admin-access" type="button" onClick={() => setPage('admin')}>Painel</button>}
          </>
        )}
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Alternar tema visual">{theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}</button>
      </nav>
    </header>
  );
}

export function PublicShowcase({ salon, services, professionals, portfolio, setPage }) {
  return (
    <main style={tenantStyle(salon)} data-site-template={(salon.siteTemplate || 'ELEGANCE').toLowerCase()}>
      <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(14,12,23,.92), rgba(14,12,23,.55)), url(${salon.heroImage})` }}>
        <div className="hero-content">
          <span className="eyebrow">{salon.name}</span>
          <h1>{salon.heroTitle || salon.name}</h1>
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

      <section className="container section-grid" id="servicos">
        <SectionTitle label="Serviços" title="Encontre o cuidado ideal para você" text="Consulte nossos serviços, duração e valores antes de reservar seu horário." />
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

      {portfolio.length > 0 && (
        <section className="container section-grid" id="trabalhos">
          <SectionTitle label="Galeria" title="Nosso trabalho" text="Conheça alguns resultados e experiências do salão." />
          <div className="portfolio-grid">
            {portfolio.map((item) => (
              <article className="portfolio-card" key={item.id}>
                <img src={item.imageUrl} alt={item.title} />
                <div><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {professionals.length > 0 && (
        <section className="container section-grid" id="equipe">
          <SectionTitle label="Equipe" title="Quem vai cuidar de você" text="Conheça os profissionais e escolha quem combina melhor com o serviço que procura." />
          <div className="cards two">
            {professionals.map((professional) => (
              <article className="profile-card" key={professional.id}>
                <img src={professional.photoUrl || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=900&auto=format&fit=crop'} alt={professional.name} />
                <div><h3>{professional.name}</h3><strong>{professional.specialty}</strong><p>{professional.bio}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="container section-grid" id="contato">
        <SectionTitle label="Contato" title="Pronto para reservar?" text={`${salon.openingHours} • ${salon.address}`} />
        <div className="hero-actions">
          <button className="primary" onClick={() => setPage('booking')}>Escolher horário</button>
          <a className="secondary" href={`https://wa.me/${salon.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {salon.instagram && <a className="secondary" href={`https://instagram.com/${salon.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">Instagram</a>}
        </div>
      </section>
    </main>
  );
}

export function BookingPage({ services, professionals, onCreated, salon }) {
  return <PublicBookingCalendar services={services} professionals={professionals} onCreated={onCreated} salon={salon} />;
}

export function LoginPage({ setPage, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('glossflow.token', data.token);
      if (data.refreshToken) localStorage.setItem('glossflow.refreshToken', data.refreshToken);
      onLogin(data.token);
      setPage(data.user?.role === 'SUPER_ADMIN' ? 'platform-admin' : 'admin');
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main className="container compact">
      <SectionTitle label="GlossFlow" title="Acesso administrativo" text="Entre com a conta cadastrada para gerenciar o salão." />
      <form className="form-card" onSubmit={submit}>
        <Input label="E-mail" type="email" value={email} onChange={setEmail} required />
        <Input label="Senha" type="password" value={password} onChange={setPassword} required />
        <button className="primary full" type="submit">Entrar no painel</button>
        {message && <p className="feedback error">{message}</p>}
      </form>
    </main>
  );
}
