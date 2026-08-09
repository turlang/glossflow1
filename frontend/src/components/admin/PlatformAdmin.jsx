import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { MODULE_CATALOG } from '../../utils/modules';
import { NewClientWizard } from './NewClientWizard.jsx';
import { PlatformSiteManager } from './PlatformSiteManager.jsx';

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function StatusBadge({ status }) {
  const label = status || 'SEM PLANO';
  return <span className={`status-badge status-${label.toLowerCase().replaceAll('_', '-')}`}>{label}</span>;
}

const initialClient = {
  name: '',
  slug: '',
  phone: '',
  whatsapp: '',
  address: '',
  openingHours: 'Segunda a sábado, 09h às 19h',
  description: '',
  instagram: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  enabledModules: ['SITE', 'AGENDA']
};

const initialPlan = { name: '', price: '', maxUsers: 5, maxSalons: 1, features: '', active: true };

const box = (active = false) => ({
  border: `1px solid ${active ? 'rgba(52,211,153,.45)' : 'var(--line)'}`,
  background: active ? 'rgba(52,211,153,.08)' : 'rgba(255,255,255,.025)',
  borderRadius: 16,
  padding: 14
});

export function PlatformAdmin({ setPage }) {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [salons, setSalons] = useState([]);
  const [plans, setPlans] = useState([]);
  const [infra, setInfra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingSalonId, setEditingSalonId] = useState('');
  const [moduleDrafts, setModuleDrafts] = useState({});
  const [metricsBySalon, setMetricsBySalon] = useState({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState({});
  const [adminDrafts, setAdminDrafts] = useState({});
  const [saving, setSaving] = useState('');
  const [newClient, setNewClient] = useState(initialClient);
  const [newPlan, setNewPlan] = useState(initialPlan);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overviewData, salonsData, plansData] = await Promise.all([
        request('/platform-admin/overview'),
        request('/platform-admin/salons'),
        request('/platform-admin/plans')
      ]);

      setOverview(overviewData);
      setSalons(salonsData);
      setPlans(plansData);
      setModuleDrafts(Object.fromEntries(salonsData.map((salon) => [salon.id, salon.enabledModules || []])));
      setSubscriptionDrafts(Object.fromEntries(salonsData.map((salon) => [salon.id, {
        planId: salon.subscription?.planId || '',
        status: salon.subscription?.status || 'TRIAL',
        endsAt: salon.subscription?.endsAt ? String(salon.subscription.endsAt).slice(0, 10) : ''
      }])));
      setAdminDrafts(Object.fromEntries(salonsData.map((salon) => [salon.id, {
        name: salon.owner?.name || '',
        email: salon.owner?.email || '',
        password: '',
        active: salon.owner?.active !== false
      }])));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o painel global.');
    } finally {
      setLoading(false);
    }
  }

  async function loadInfra() {
    try {
      const [integrations, observability] = await Promise.all([
        request('/platform-admin/integrations'),
        request('/platform-admin/observability')
      ]);
      setInfra({ integrations, observability });
    } catch (err) {
      setMessage(err.message || 'Não foi possível carregar a infraestrutura.');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'infra' && !infra) loadInfra(); }, [tab]);

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
    setModuleDrafts((current) => {
      const active = new Set(current[salonId] || []);
      if (active.has(moduleKey)) active.delete(moduleKey); else active.add(moduleKey);
      return { ...current, [salonId]: [...active] };
    });
  }

  async function openSalon(salon) {
    const next = editingSalonId === salon.id ? '' : salon.id;
    setEditingSalonId(next);
    setMessage('');

    if (next && !metricsBySalon[salon.id]) {
      try {
        const metrics = await request(`/platform-admin/salons/${salon.id}/metrics`);
        setMetricsBySalon((current) => ({ ...current, [salon.id]: metrics }));
      } catch (err) {
        setMessage(err.message || 'Não foi possível carregar as métricas deste salão.');
      }
    }
  }

  async function saveModules(salon) {
    setSaving(`modules-${salon.id}`);
    try {
      const updated = await request(`/platform-admin/salons/${salon.id}/modules`, {
        method: 'PUT',
        body: JSON.stringify({ enabledModules: moduleDrafts[salon.id] || [] })
      });
      setSalons((current) => current.map((item) => item.id === salon.id
        ? { ...item, modulesConfigured: true, enabledModules: updated.enabledModules }
        : item));
      setMessage(`Módulos de ${salon.name} atualizados.`);
    } catch (err) {
      setMessage(err.message || 'Não foi possível atualizar os módulos.');
    } finally {
      setSaving('');
    }
  }

  async function saveSubscription(salon) {
    const draft = subscriptionDrafts[salon.id] || {};
    if (!draft.planId) return setMessage('Escolha um plano antes de salvar a assinatura.');

    setSaving(`subscription-${salon.id}`);
    try {
      await request(`/platform-admin/salons/${salon.id}/subscription`, {
        method: 'PUT',
        body: JSON.stringify(draft)
      });
      setMessage(`Assinatura de ${salon.name} atualizada.`);
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível atualizar a assinatura.');
    } finally {
      setSaving('');
    }
  }

  async function saveAdminAccess(salon) {
    const draft = adminDrafts[salon.id] || {};
    setSaving(`admin-${salon.id}`);
    try {
      const payload = { name: draft.name, email: draft.email, active: draft.active };
      if (draft.password) payload.password = draft.password;

      await request(`/platform-admin/salons/${salon.id}/admin-access`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setMessage(`Acesso administrativo de ${salon.name} atualizado.`);
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível atualizar o acesso do cliente.');
    } finally {
      setSaving('');
    }
  }

  async function createClient(event) {
    event.preventDefault();
    setSaving('new-client');
    setMessage('');
    try {
      await request('/platform-admin/salons', {
        method: 'POST',
        body: JSON.stringify(newClient)
      });
      setNewClient(initialClient);
      setMessage('Cliente criado. O salão e o primeiro ADMIN estão prontos.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível cadastrar o cliente.');
    } finally {
      setSaving('');
    }
  }

  async function createPlan(event) {
    event.preventDefault();
    setSaving('new-plan');
    try {
      await request('/platform-admin/plans', {
        method: 'POST',
        body: JSON.stringify(newPlan)
      });
      setNewPlan(initialPlan);
      setMessage('Plano criado com sucesso.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível criar o plano.');
    } finally {
      setSaving('');
    }
  }

  const tabs = [
    ['overview', '◈', 'Visão geral', 'MRR e saúde comercial'],
    ['clients', '◆', 'Clientes', 'Tenants, acessos e módulos'],
    ['sites', '✦', 'Site & Marca', 'White-label dos clientes'],
    ['plans', '◇', 'Planos', 'Planos e assinaturas'],
    ['infra', '📡', 'Infraestrutura', 'Integrações e observabilidade']
  ];
  const tabTitle = tabs.find(([key]) => key === tab)?.[2] || 'Super Admin';

  return (
    <main className="admin-pro-shell" aria-label="Super Admin GlossFlow">
      <aside className="admin-pro-sidebar">
        <button className="admin-pro-brand" type="button">
          <span className="brand-mark">G</span>
          <span><strong>GlossFlow</strong><small>Super Admin</small></span>
        </button>

        <nav className="admin-pro-nav">
          {tabs.map(([key, icon, label, description]) => (
            <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <span className="menu-icon">{icon}</span>
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
          <button type="button" onClick={() => setPage('public')}>
            <span className="menu-icon">↗</span>
            <span><strong>Ver site</strong><small>Vitrine pública</small></span>
          </button>
        </nav>

        <button className="admin-logout" type="button" onClick={logout}>Sair do Super Admin</button>
      </aside>

      <section className="admin-pro-main">
        <header className="admin-pro-topbar">
          <div>
            <span className="eyebrow">GlossFlow Platform</span>
            <h1>{tabTitle}</h1>
            <p>Administração global separada da operação dos salões.</p>
          </div>
          <div className="topbar-actions">
            <button className="primary" type="button" onClick={load}>Atualizar dados</button>
          </div>
        </header>

        {loading && <section className="panel-card"><p>Carregando plataforma...</p></section>}
        {error && <section className="panel-card"><p className="feedback error">{error}</p></section>}
        {message && <section className="panel-card"><p className="feedback">{message}</p></section>}

        {!loading && !error && overview && tab === 'overview' && (
          <>
            <section className="admin-pro-stats">
              {[
                ['◆', overview.totals?.salons || 0, 'Clientes', 'Tenants cadastrados'],
                ['●', activeSalons, 'Ativos', 'Assinaturas ACTIVE'],
                ['◎', overview.totals?.users || 0, 'Usuários', 'Contas de clientes'],
                ['R$', money(overview.revenue?.mrr || 0), 'MRR', 'Receita recorrente'],
                ['◌', overview.subscriptionStatus?.trial || 0, 'Trials', 'Em avaliação'],
                ['!', overview.subscriptionStatus?.pastDue || 0, 'Inadimplentes', 'PAST_DUE']
              ].map(([icon, value, label, hint]) => (
                <article className="pro-stat-card" key={label}>
                  <span className="pro-stat-icon">{icon}</span>
                  <div><strong>{value}</strong><span>{label}</span><small>{hint}</small></div>
                </article>
              ))}
            </section>

            <section className="panel-card">
              <span className="eyebrow">Movimentação comercial</span>
              <h2>Assinaturas recentes</h2>
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

        {!loading && !error && tab === 'clients' && (
          <>
            <NewClientWizard
              value={newClient}
              setValue={setNewClient}
              modules={MODULE_CATALOG}
              saving={saving === 'new-client'}
              onSubmit={createClient}
            />

            <section className="panel-card" style={{ marginTop: 20 }}>
              <span className="eyebrow">Clientes da plataforma</span>
              <h2>Gestão por salão</h2>
              <div className="list full-span" style={{ marginTop: 18 }}>
                {salons.map((salon) => {
                  const expanded = editingSalonId === salon.id;
                  const activeModules = moduleDrafts[salon.id] || [];
                  const metrics = metricsBySalon[salon.id];
                  const sub = subscriptionDrafts[salon.id] || {};
                  const admin = adminDrafts[salon.id] || {};

                  return (
                    <div key={salon.id} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
                      <div className="list-row" style={{ border: 0, padding: 0 }}>
                        <span>
                          <strong>{salon.name}</strong><br />
                          <small>{salon.slug} • {salon.owner?.email || 'sem ADMIN'} • {activeModules.length}/{MODULE_CATALOG.length} módulos</small>
                        </span>
                        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <StatusBadge status={salon.subscription?.status} />
                          <button className="secondary" type="button" onClick={() => openSalon(salon)}>{expanded ? 'Fechar' : 'Gerenciar cliente'}</button>
                          <button className="secondary" type="button" onClick={() => setTab('sites')}>Site & Marca</button>
                        </span>
                      </div>

                      {expanded && (
                        <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                            {metrics ? [
                              ['Agendamentos', metrics.operation.appointments],
                              ['Próximos', metrics.operation.upcoming],
                              ['Clientes', metrics.operation.clients],
                              ['Profissionais', metrics.operation.professionals],
                              ['Serviços', metrics.operation.services],
                              ['Estoque baixo', metrics.operation.lowStock],
                              ['Receita mês', money(metrics.finance.monthRevenue)],
                              ['Lucro mês', money(metrics.finance.monthProfit)]
                            ].map(([label, value]) => (
                              <div key={label} style={box()}>
                                <small>{label}</small>
                                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
                              </div>
                            )) : <p>Carregando métricas...</p>}
                          </div>

                          <div style={box()}>
                            <strong>Módulos contratados</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8, marginTop: 10 }}>
                              {MODULE_CATALOG.map((module) => {
                                const checked = activeModules.includes(module.key);
                                return (
                                  <label key={module.key} style={box(checked)}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleModule(salon.id, module.key)} />{' '}
                                    <strong>{module.label}</strong><br />
                                    <small>{module.description}</small>
                                  </label>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                              <button className="primary" type="button" disabled={saving === `modules-${salon.id}`} onClick={() => saveModules(salon)}>Salvar módulos</button>
                            </div>
                          </div>

                          <div style={box()}>
                            <strong>Plano e assinatura</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}>
                              <label>
                                <span>Plano</span>
                                <select value={sub.planId || ''} onChange={(event) => setSubscriptionDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], planId: event.target.value } }))}>
                                  <option value="">Selecione</option>
                                  {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {money(plan.price)}</option>)}
                                </select>
                              </label>
                              <label>
                                <span>Status</span>
                                <select value={sub.status || 'TRIAL'} onChange={(event) => setSubscriptionDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], status: event.target.value } }))}>
                                  {['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'].map((status) => <option key={status}>{status}</option>)}
                                </select>
                              </label>
                              <label>
                                <span>Vencimento/fim</span>
                                <input type="date" value={sub.endsAt || ''} onChange={(event) => setSubscriptionDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], endsAt: event.target.value } }))} />
                              </label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                              <button className="primary" type="button" onClick={() => saveSubscription(salon)}>Salvar assinatura</button>
                            </div>
                          </div>

                          <div style={box()}>
                            <strong>Acesso do ADMIN do salão</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginTop: 10 }}>
                              <label><span>Nome</span><input value={admin.name || ''} onChange={(event) => setAdminDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], name: event.target.value } }))} /></label>
                              <label><span>E-mail</span><input type="email" value={admin.email || ''} onChange={(event) => setAdminDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], email: event.target.value } }))} /></label>
                              <label><span>Nova senha</span><input type="password" placeholder="12+ caracteres" value={admin.password || ''} onChange={(event) => setAdminDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], password: event.target.value } }))} /></label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={admin.active !== false} onChange={(event) => setAdminDrafts((current) => ({ ...current, [salon.id]: { ...current[salon.id], active: event.target.checked } }))} /> Conta ativa</label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                              <button className="primary" type="button" onClick={() => saveAdminAccess(salon)}>Salvar acesso</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {salons.length === 0 && <p className="empty-state">Nenhum cliente cadastrado.</p>}
              </div>
            </section>
          </>
        )}

        {!loading && !error && tab === 'sites' && <PlatformSiteManager salons={salons} />}

        {!loading && !error && tab === 'plans' && (
          <>
            <section className="panel-card">
              <span className="eyebrow">Catálogo comercial</span>
              <h2>Criar plano</h2>
              <form onSubmit={createPlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 16 }}>
                <label><span>Nome</span><input required value={newPlan.name} onChange={(event) => setNewPlan((current) => ({ ...current, name: event.target.value }))} /></label>
                <label><span>Preço mensal</span><input required type="number" min="0" step="0.01" value={newPlan.price} onChange={(event) => setNewPlan((current) => ({ ...current, price: event.target.value }))} /></label>
                <label><span>Máx. usuários</span><input required type="number" min="1" value={newPlan.maxUsers} onChange={(event) => setNewPlan((current) => ({ ...current, maxUsers: event.target.value }))} /></label>
                <label style={{ gridColumn: '1 / -1' }}><span>Recursos/descrição</span><textarea required value={newPlan.features} onChange={(event) => setNewPlan((current) => ({ ...current, features: event.target.value }))} /></label>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><button className="primary" disabled={saving === 'new-plan'}>{saving === 'new-plan' ? 'Criando...' : 'Criar plano'}</button></div>
              </form>
            </section>

            <section className="panel-card">
              <span className="eyebrow">Planos cadastrados</span>
              <h2>Oferta da plataforma</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginTop: 16 }}>
                {plans.map((plan) => (
                  <article key={plan.id} style={box(plan.active)}>
                    <strong>{plan.name}</strong>
                    <div style={{ fontSize: 26, fontWeight: 900, margin: '8px 0' }}>{money(plan.price)}<small>/mês</small></div>
                    <p>{plan.features}</p>
                    <small>{plan.maxUsers} usuário(s) • {plan.active ? 'Ativo' : 'Inativo'}</small>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {!loading && !error && tab === 'infra' && (
          <>
            <section className="panel-card">
              <span className="eyebrow">Infraestrutura</span>
              <h2>Saúde da plataforma</h2>
              {infra ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 14 }}>
                  {[
                    ['Uptime', `${Math.round((infra.observability.service.uptimeSeconds || 0) / 60)} min`],
                    ['Latência', `${infra.observability.service.averageLatency || 0} ms`],
                    ['Requisições', infra.observability.service.totalRequests || 0],
                    ['Erros', infra.observability.service.errors || 0],
                    ['Sessões ativas', infra.observability.security.activeSessions || 0],
                    ['Auditorias', infra.observability.security.auditLogs || 0]
                  ].map(([label, value]) => <div key={label} style={box()}><small>{label}</small><div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div></div>)}
                </div>
              ) : <p>Carregando...</p>}
            </section>

            <section className="panel-card">
              <span className="eyebrow">Conectores globais</span>
              <h2>Integrações do GlossFlow</h2>
              {infra && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginTop: 14 }}>
                  {(infra.integrations.integrations || []).map((item) => (
                    <article key={item.key} style={box(item.status === 'connected')}>
                      <strong>{item.name || item.key}</strong>
                      <p><StatusBadge status={item.status} /></p>
                      {item.missingEnv?.length > 0 && <small>Pendente: {item.missingEnv.join(', ')}</small>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
