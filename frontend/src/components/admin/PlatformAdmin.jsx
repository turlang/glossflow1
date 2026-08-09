import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function StatusBadge({ status }) {
  const label = status || 'SEM PLANO';
  return <span className={`status-badge status-${label.toLowerCase().replaceAll('_', '-')}`}>{label}</span>;
}

/**
 * Painel global da plataforma.
 * Este componente nunca consome rotas operacionais de um salão. Todos os dados
 * vêm exclusivamente de /platform-admin/*, protegido no backend por SUPER_ADMIN.
 */
export function PlatformAdmin({ setPage }) {
  const [overview, setOverview] = useState(null);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overviewData, salonsData] = await Promise.all([
        request('/platform-admin/overview'),
        request('/platform-admin/salons')
      ]);
      setOverview(overviewData);
      setSalons(salonsData);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o painel global.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const activeSalons = useMemo(
    () => salons.filter((salon) => salon.subscription?.status === 'ACTIVE').length,
    [salons]
  );

  function logout() {
    localStorage.removeItem('glossflow.token');
    localStorage.removeItem('glossflow.refreshToken');
    setPage('login');
  }

  return (
    <main className="admin-pro-shell" aria-label="Super Admin GlossFlow">
      <aside className="admin-pro-sidebar">
        <button className="admin-pro-brand" type="button">
          <span className="brand-mark">G</span>
          <span><strong>GlossFlow</strong><small>Super Admin</small></span>
        </button>
        <nav className="admin-pro-nav">
          <button type="button" className="active"><span className="menu-icon">◈</span><span><strong>Plataforma</strong><small>Visão geral do SaaS</small></span></button>
          <button type="button" onClick={() => setPage('public')}><span className="menu-icon">↗</span><span><strong>Ver site</strong><small>Vitrine pública</small></span></button>
        </nav>
        <button className="admin-logout" type="button" onClick={logout}>Sair do Super Admin</button>
      </aside>

      <section className="admin-pro-main">
        <header className="admin-pro-topbar">
          <div>
            <span className="eyebrow">GlossFlow Platform</span>
            <h1>Super Admin</h1>
            <p>Visão global da plataforma, clientes, assinaturas e receita recorrente.</p>
          </div>
          <div className="topbar-actions">
            <button className="primary" type="button" onClick={load}>Atualizar dados</button>
          </div>
        </header>

        {loading && <section className="panel-card"><p>Carregando métricas globais...</p></section>}
        {error && <section className="panel-card"><p className="feedback error">{error}</p></section>}

        {!loading && !error && overview && (
          <>
            <section className="admin-pro-stats">
              <article className="pro-stat-card"><span className="pro-stat-icon">◆</span><div><strong>{overview.totals?.salons || 0}</strong><span>Salões cadastrados</span><small>Todos os tenants</small></div></article>
              <article className="pro-stat-card"><span className="pro-stat-icon">●</span><div><strong>{activeSalons}</strong><span>Salões ativos</span><small>Assinaturas ACTIVE</small></div></article>
              <article className="pro-stat-card"><span className="pro-stat-icon">◎</span><div><strong>{overview.totals?.users || 0}</strong><span>Usuários</span><small>Contas na plataforma</small></div></article>
              <article className="pro-stat-card"><span className="pro-stat-icon">R$</span><div><strong>{money(overview.revenue?.mrr || 0)}</strong><span>MRR</span><small>Receita recorrente mensal</small></div></article>
              <article className="pro-stat-card"><span className="pro-stat-icon">◌</span><div><strong>{overview.subscriptionStatus?.trial || 0}</strong><span>Trials</span><small>Em avaliação</small></div></article>
              <article className="pro-stat-card"><span className="pro-stat-icon">!</span><div><strong>{overview.subscriptionStatus?.pastDue || 0}</strong><span>Inadimplentes</span><small>PAST_DUE</small></div></article>
            </section>

            <section className="panel-card">
              <span className="eyebrow">Clientes da plataforma</span>
              <h2>Salões e assinaturas</h2>
              <div className="list full-span">
                {salons.map((salon) => (
                  <div className="list-row" key={salon.id}>
                    <span>
                      <strong>{salon.name}</strong><br />
                      <small>{salon.slug} • {salon.users} usuário(s) • {salon.whatsapp || 'WhatsApp não configurado'}</small>
                    </span>
                    <span>
                      <StatusBadge status={salon.subscription?.status} />
                      <br />
                      <small>{salon.subscription?.plan || 'Sem plano'} {salon.subscription?.price != null ? `• ${money(salon.subscription.price)}` : ''}</small>
                    </span>
                  </div>
                ))}
                {salons.length === 0 && <p className="empty-state">Nenhum salão cadastrado.</p>}
              </div>
            </section>

            <section className="panel-card">
              <span className="eyebrow">Assinaturas recentes</span>
              <h2>Movimentação comercial</h2>
              <div className="list full-span">
                {(overview.recentSubscriptions || []).map((item) => (
                  <div className="list-row" key={item.id}>
                    <span><strong>{item.salon || 'Salão'}</strong><br /><small>{item.plan || 'Sem plano'}</small></span>
                    <span><StatusBadge status={item.status} /><br /><small>{money(item.price || 0)}</small></span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
