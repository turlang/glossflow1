import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { MODULE_CATALOG } from '../../utils/modules';

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function StatusBadge({ status }) {
  const label = status || 'SEM PLANO';
  return <span className={`status-badge status-${label.toLowerCase().replaceAll('_', '-')}`}>{label}</span>;
}

export function PlatformAdmin({ setPage }) {
  const [overview, setOverview] = useState(null);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSalonId, setEditingSalonId] = useState('');
  const [moduleDrafts, setModuleDrafts] = useState({});
  const [savingModules, setSavingModules] = useState('');
  const [moduleMessage, setModuleMessage] = useState('');

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
      setModuleDrafts(Object.fromEntries(salonsData.map((salon) => [salon.id, salon.enabledModules || []])));
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

  function toggleModule(salonId, moduleKey) {
    setModuleMessage('');
    setModuleDrafts((current) => {
      const active = new Set(current[salonId] || []);
      if (active.has(moduleKey)) active.delete(moduleKey);
      else active.add(moduleKey);
      return { ...current, [salonId]: [...active] };
    });
  }

  async function saveModules(salon) {
    setSavingModules(salon.id);
    setModuleMessage('Salvando módulos...');
    try {
      const updated = await request(`/platform-admin/salons/${salon.id}/modules`, {
        method: 'PUT',
        body: JSON.stringify({ enabledModules: moduleDrafts[salon.id] || [] })
      });
      setSalons((current) => current.map((item) => item.id === salon.id
        ? { ...item, modulesConfigured: true, enabledModules: updated.enabledModules }
        : item));
      setModuleDrafts((current) => ({ ...current, [salon.id]: updated.enabledModules }));
      setModuleMessage(`Módulos de ${salon.name} atualizados.`);
    } catch (err) {
      setModuleMessage(err.message || 'Não foi possível atualizar os módulos.');
    } finally {
      setSavingModules('');
    }
  }

  function enableAll(salonId) {
    setModuleDrafts((current) => ({ ...current, [salonId]: MODULE_CATALOG.map((item) => item.key) }));
  }

  function disableAll(salonId) {
    setModuleDrafts((current) => ({ ...current, [salonId]: [] }));
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
            <p>Visão global da plataforma, clientes, assinaturas, receita e módulos contratados.</p>
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
              <h2>Salões, assinaturas e módulos</h2>
              <p className="panel-help">Abra um salão para escolher exatamente quais módulos aquele cliente pode utilizar. A proteção é aplicada no painel e também na API.</p>
              {moduleMessage && <p className="feedback" style={{ marginTop: 14 }}>{moduleMessage}</p>}
              <div className="list full-span" style={{ marginTop: 18 }}>
                {salons.map((salon) => {
                  const expanded = editingSalonId === salon.id;
                  const activeModules = moduleDrafts[salon.id] || [];
                  return (
                    <div key={salon.id} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
                      <div className="list-row" style={{ border: 0, padding: 0 }}>
                        <span>
                          <strong>{salon.name}</strong><br />
                          <small>{salon.slug} • {salon.users} usuário(s) • {activeModules.length}/{MODULE_CATALOG.length} módulos ativos</small>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span><StatusBadge status={salon.subscription?.status} /><br /><small>{salon.subscription?.plan || 'Sem plano'} {salon.subscription?.price != null ? `• ${money(salon.subscription.price)}` : ''}</small></span>
                          <button className="secondary" type="button" onClick={() => setEditingSalonId(expanded ? '' : salon.id)}>{expanded ? 'Fechar' : 'Gerenciar módulos'}</button>
                        </span>
                      </div>

                      {expanded && (
                        <div style={{ marginTop: 18, padding: 18, borderRadius: 18, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                            <div><strong>Módulos de {salon.name}</strong><br /><small>{salon.modulesConfigured ? 'Configuração personalizada' : 'Ainda no padrão: todos os módulos habilitados'}</small></div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="ghost-button" type="button" onClick={() => enableAll(salon.id)}>Ativar todos</button>
                              <button className="ghost-button" type="button" onClick={() => disableAll(salon.id)}>Desativar todos</button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                            {MODULE_CATALOG.map((module) => {
                              const checked = activeModules.includes(module.key);
                              return (
                                <label key={module.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16, border: `1px solid ${checked ? 'rgba(52,211,153,.42)' : 'var(--line)'}`, background: checked ? 'rgba(52,211,153,.08)' : 'rgba(255,255,255,.025)', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleModule(salon.id, module.key)} style={{ marginTop: 4 }} />
                                  <span><strong>{module.label}</strong><br /><small>{module.description}</small></span>
                                </label>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <button className="primary" type="button" disabled={savingModules === salon.id} onClick={() => saveModules(salon)}>{savingModules === salon.id ? 'Salvando...' : 'Salvar módulos do cliente'}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
