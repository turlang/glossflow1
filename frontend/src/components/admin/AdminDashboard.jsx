import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { AdminCrud, EditableList, ImageInput, Input, List, SectionTitle, Select, Textarea } from '../ui/Forms.jsx';

/**
 * Painel administrativo do GlossFlow.
 * Centraliza os módulos de operação fora do App principal, preparando o produto para Agenda Enterprise.
 */

export function AdminDashboard({ salon, services, professionals, portfolio, appointments, inventory, users, clients, financialEntries, commissions, loyalty, subscription, whatsappTemplates, insights, reload, setPage, theme, toggleTheme }) {
  const [tab, setTab] = useState('executive');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /**
   * Centralização dos indicadores do painel.
   * Mantemos os dados derivados em useMemo para evitar recálculos desnecessários
   * quando o React renderizar a interface por mudanças em outros estados.
   */
  const stats = useMemo(() => [
    { label: 'Serviços ativos', value: services.length, hint: 'Catálogo do salão', icon: '✦' },
    { label: 'Profissionais', value: professionals.length, hint: 'Equipe cadastrada', icon: '◈' },
    { label: 'Vitrine', value: portfolio.length, hint: 'Trabalhos publicados', icon: '◆' },
    { label: 'Agenda', value: appointments.length, hint: 'Reservas registradas', icon: '●' },
    { label: 'Estoque', value: inventory.length, hint: 'Produtos monitorados', icon: '■' },
    { label: 'Usuários', value: users.length, hint: 'Acessos internos', icon: '◆' },
    { label: 'Clientes', value: clients.length, hint: 'CRM e histórico', icon: '◎' },
    { label: 'Receita', value: currency(financialEntries.filter((e) => e.type === 'REVENUE').reduce((sum, e) => sum + Number(e.amount || 0), 0)), hint: 'Financeiro registrado', icon: 'R$' }
  ], [services, professionals, portfolio, appointments, inventory, users, clients, financialEntries]);

  /**
   * Navegação administrativa padronizada.
   * Cada item possui chave estável, texto visível, descrição e ícone simples,
   * mantendo acessibilidade e evitando dependência obrigatória de bibliotecas externas.
   */
  const menu = [
    { key: 'executive', label: 'Dashboard', description: 'Receita, lucro e crescimento', icon: '📊' },
    { key: 'services', label: 'Serviços', description: 'Preços, duração e imagens', icon: '✂' },
    { key: 'professionals', label: 'Profissionais', description: 'Equipe e especialidades', icon: '♛' },
    { key: 'portfolio', label: 'Vitrine', description: 'Galeria pública do salão', icon: '◐' },
    { key: 'appointments', label: 'Agenda', description: 'Calendário e post-its', icon: '▦' },
    { key: 'inventory', label: 'Estoque', description: 'Produtos e reposição', icon: '▣' },
    { key: 'users', label: 'Usuários', description: 'Acessos e permissões', icon: '◉' },
    { key: 'clients', label: 'Clientes', description: 'CRM e fidelidade', icon: '◎' },
    { key: 'financial', label: 'Financeiro', description: 'Caixa, receita e despesa', icon: 'R$' },
    { key: 'commissions', label: 'Comissões', description: 'Regras e projeções', icon: '%' },
    { key: 'loyalty', label: 'Fidelidade', description: 'Pontos e recompensas', icon: '★' },
    { key: 'subscription', label: 'Assinatura', description: 'Planos do SaaS', icon: '◇' },
    { key: 'automations', label: 'Automações', description: 'WhatsApp e relacionamento', icon: '⚡' },
    { key: 'assistant', label: 'Assistente IA', description: 'Perguntas, campanhas e decisões', icon: '🤖' },
    { key: 'security', label: 'Segurança', description: 'Auditoria, sessões e LGPD', icon: '🛡️' },
    { key: 'ecosystem', label: 'Ecossistema', description: 'WhatsApp, pagamentos e marketing', icon: '🔌' },
    { key: 'observability', label: 'Observabilidade', description: 'Métricas, saúde e alertas', icon: '📡' },
    { key: 'ux', label: 'UX Premium', description: 'Tour, busca e atalhos', icon: '✨' },
    { key: 'pwa', label: 'App/PWA', description: 'Instalação, offline e mobile', icon: '📱' }
  ];

  const [command, setCommand] = useState('');
  const filteredMenu = command.trim() ? menu.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(command.toLowerCase())) : menu;
  const activeMenu = menu.find((item) => item.key === tab) || menu[0];

  function logout() {
    localStorage.removeItem('glossflow.token');
    localStorage.removeItem('glossflow.refreshToken');
    setPage('login');
  }

  return (
    <main className={`admin-pro-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} aria-label="Painel administrativo GlossFlow">
      <aside className="admin-pro-sidebar">
        <button className="admin-pro-brand" type="button" onClick={() => setPage('public')} aria-label="Voltar para vitrine pública">
          <span className="brand-mark">G</span>
          <span><strong>GlossFlow</strong><small>Beauty SaaS</small></span>
        </button>

        <button className="sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label="Recolher ou expandir menu lateral">
          {sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        </button>

        <div className="salon-card-mini">
          <span>Salão conectado</span>
          <strong>{salon.name}</strong>
          <small>{salon.openingHours}</small>
        </div>

        <nav className="admin-pro-nav" aria-label="Módulos administrativos">
          <label className="global-command">
            <span>Busca rápida</span>
            <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Buscar módulo..." />
          </label>
          {filteredMenu.map((item) => (
            <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
              <span className="menu-icon">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>

        <button className="admin-logout" type="button" onClick={logout}>Sair do painel</button>
      </aside>

      <section className="admin-pro-main">
        <header className="admin-pro-topbar">
          <div>
            <span className="eyebrow">Painel operacional</span>
            <h1>{activeMenu.label}</h1>
            <p>{activeMenu.description}</p>
          </div>
          <div className="topbar-actions">
            <button className="secondary" type="button" onClick={toggleTheme}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button>
            <button className="secondary" type="button" onClick={() => setPage('public')}>Ver vitrine</button>
            <button className="primary" type="button" onClick={reload}>Atualizar dados</button>
          </div>
        </header>

        <OnboardingChecklist
          services={services}
          professionals={professionals}
          portfolio={portfolio}
          whatsappTemplates={whatsappTemplates}
          inventory={inventory}
          setTab={setTab}
        />

        <section className="admin-pro-stats" aria-label="Resumo administrativo">
          {stats.map((item) => (
            <article className="pro-stat-card" key={item.label}>
              <span className="pro-stat-icon">{item.icon}</span>
              <div>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="admin-pro-content">
          {tab === 'executive' && <ExecutiveDashboard services={services} professionals={professionals} appointments={appointments} clients={clients} inventory={inventory} financialEntries={financialEntries} commissions={commissions} insights={insights} setTab={setTab} />}
          {tab === 'services' && <ServicesAdmin services={services} reload={reload} />}
          {tab === 'professionals' && <ProfessionalsAdmin professionals={professionals} reload={reload} />}
          {tab === 'portfolio' && <PortfolioAdmin portfolio={portfolio} reload={reload} />}
          {tab === 'appointments' && <AppointmentsAdmin appointments={appointments} professionals={professionals} services={services} reload={reload} />}
          {tab === 'inventory' && <InventoryAdmin inventory={inventory} reload={reload} />}
          {tab === 'users' && <UsersAdmin users={users} reload={reload} />}
          {tab === 'clients' && <ClientsAdmin clients={clients} reload={reload} />}
          {tab === 'financial' && <FinancialAdmin financialEntries={financialEntries} reload={reload} />}
          {tab === 'commissions' && <CommissionsAdmin commissions={commissions} professionals={professionals} reload={reload} />}
          {tab === 'loyalty' && <LoyaltyAdmin loyalty={loyalty} clients={clients} reload={reload} />}
          {tab === 'subscription' && <SubscriptionAdmin subscription={subscription} reload={reload} />}
          {tab === 'automations' && <AutomationsAdmin whatsappTemplates={whatsappTemplates} insights={insights} reload={reload} />}
          {tab === 'assistant' && <AIAssistantAdmin services={services} professionals={professionals} appointments={appointments} inventory={inventory} clients={clients} financialEntries={financialEntries} insights={insights} reload={reload} />}
          {tab === 'security' && <SecurityAdmin clients={clients} reload={reload} />}
          {tab === 'ecosystem' && <EcosystemAdmin />}
          {tab === 'observability' && <ObservabilityAdmin />}
          {tab === 'ux' && <UXPremiumAdmin setTab={setTab} />}
          {tab === 'pwa' && <PWAAdmin />}
        </section>
      </section>
    </main>
  );
}

function OnboardingChecklist({ services, professionals, portfolio, whatsappTemplates, inventory, setTab }) {
  /**
   * Assistente de implantação
   * ------------------------------------------------------------------
   * O objetivo deste bloco é conduzir o administrador por uma jornada clara
   * de configuração. Produtos SaaS maduros reduzem menus soltos e orientam o
   * usuário em tarefas de valor: configurar, publicar, vender e automatizar.
   */
  const steps = [
    { label: 'Cadastrar serviços', done: services.length > 0, tab: 'services', help: 'Catálogo com preço, duração e imagem.' },
    { label: 'Cadastrar profissionais', done: professionals.length > 0, tab: 'professionals', help: 'Equipe com foto e especialidade.' },
    { label: 'Montar vitrine', done: portfolio.length > 0, tab: 'portfolio', help: 'Trabalhos reais para converter clientes.' },
    { label: 'Conferir estoque', done: inventory.length > 0, tab: 'inventory', help: 'Produtos, mínimos e alertas.' },
    { label: 'Ativar automações', done: whatsappTemplates.length > 0, tab: 'automations', help: 'Confirmação, lembrete e relacionamento.' }
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <section className="enterprise-onboarding" aria-label="Assistente de configuração do salão">
      <div className="onboarding-summary">
        <span className="eyebrow">Implantação guiada</span>
        <h2>Seu salão pronto para vender mais</h2>
        <p>Complete as etapas principais para transformar a vitrine, agenda e automações em um fluxo comercial completo.</p>
      </div>
      <div className="onboarding-progress" aria-label={`${progress}% concluído`}>
        <strong>{progress}%</strong>
        <span>configurado</span>
        <div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="onboarding-steps">
        {steps.map((step) => (
          <button key={step.label} type="button" className={step.done ? 'done' : ''} onClick={() => setTab(step.tab)}>
            <b>{step.done ? '✓' : '○'}</b>
            <span><strong>{step.label}</strong><small>{step.help}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}


function ExecutiveDashboard({ services, professionals, appointments, clients, inventory, financialEntries, commissions, insights, setTab }) {
  /**
   * Dashboard Executivo — Fase 4
   * ------------------------------------------------------------------
   * Este módulo transforma dados operacionais em indicadores de decisão:
   * receita, despesas, lucro, ticket médio, retenção, rankings e previsão.
   * A lógica permanece local no frontend para manter o MVP simples; em
   * produção, estes cálculos podem ser movidos para uma rota analítica.
   */
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const todayKey = now.toISOString().slice(0, 10);

  const money = (value) => Number(value || 0);
  const isSameMonth = (date) => String(date || '').slice(0, 7) === monthKey;
  const isToday = (date) => String(date || '').slice(0, 10) === todayKey;

  const revenueEntries = financialEntries.filter((entry) => entry.type === 'REVENUE');
  const expenseEntries = financialEntries.filter((entry) => entry.type === 'EXPENSE');
  const monthRevenue = revenueEntries.filter((entry) => isSameMonth(entry.date || entry.createdAt)).reduce((sum, entry) => sum + money(entry.amount), 0);
  const monthExpenses = expenseEntries.filter((entry) => isSameMonth(entry.date || entry.createdAt)).reduce((sum, entry) => sum + money(entry.amount), 0);
  const todayRevenue = revenueEntries.filter((entry) => isToday(entry.date || entry.createdAt)).reduce((sum, entry) => sum + money(entry.amount), 0);

  const commissionTotal = Array.isArray(commissions?.projections)
    ? commissions.projections.reduce((sum, item) => sum + money(item.commissionAmount || item.amount || item.total), 0)
    : 0;

  const netProfit = monthRevenue - monthExpenses - commissionTotal;
  const completedOrConfirmed = appointments.filter((appointment) => ['COMPLETED', 'CONFIRMED'].includes(appointment.status));
  const agendaPotential = appointments.reduce((sum, appointment) => sum + money(appointment.service?.price), 0);
  const averageTicket = completedOrConfirmed.length ? agendaPotential / completedOrConfirmed.length : 0;

  const uniqueClients = new Set(appointments.map((appointment) => appointment.clientPhone || appointment.clientName).filter(Boolean));
  const returningClients = new Set();
  const clientFrequency = appointments.reduce((map, appointment) => {
    const key = appointment.clientPhone || appointment.clientName;
    if (!key) return map;
    map[key] = (map[key] || 0) + 1;
    if (map[key] > 1) returningClients.add(key);
    return map;
  }, {});
  const retentionRate = uniqueClients.size ? Math.round((returningClients.size / uniqueClients.size) * 100) : 0;

  const monthlyGoal = Math.max(20000, Math.ceil((monthRevenue + agendaPotential) / 1000) * 1000 || 20000);
  const goalProgress = Math.min(100, Math.round((monthRevenue / monthlyGoal) * 100));
  const forecast = Math.round((monthRevenue + agendaPotential * 0.65) / 100) * 100;

  const serviceRanking = Object.values(appointments.reduce((map, appointment) => {
    const name = appointment.service?.name || 'Serviço não informado';
    if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
    map[name].count += 1;
    map[name].revenue += money(appointment.service?.price);
    return map;
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const professionalRanking = Object.values(appointments.reduce((map, appointment) => {
    const name = appointment.professional?.name || 'Profissional não informado';
    if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
    map[name].count += 1;
    map[name].revenue += money(appointment.service?.price);
    return map;
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const lowStock = inventory.filter((product) => Number(product.quantity || 0) <= Number(product.minQuantity || 0));
  const executiveInsights = [
    lowStock.length > 0 ? `${lowStock.length} produto(s) precisam de reposição para evitar perda operacional.` : 'Estoque em condição saudável para operação diária.',
    retentionRate < 35 ? 'A retenção está abaixo do ideal. Ative campanhas de retorno para clientes inativos.' : 'Boa retenção: clientes estão retornando ao salão.',
    forecast > monthlyGoal ? 'A projeção indica chance de superar a meta mensal.' : 'A projeção ainda está abaixo da meta; priorize serviços de maior ticket.'
  ];

  return (
    <div className="executive-dashboard">
      <section className="executive-hero panel-card full-span">
        <div>
          <span className="eyebrow">Dashboard Executivo</span>
          <h2>Gestão financeira e operacional em tempo real</h2>
          <p className="panel-help">Acompanhe receita, lucro, ticket médio, retenção, metas, rankings e sinais de atenção sem navegar por todos os módulos.</p>
        </div>
        <div className="executive-goal-card">
          <span>Meta mensal</span>
          <strong>{currency(monthRevenue)} / {currency(monthlyGoal)}</strong>
          <div className="goal-bar"><i style={{ width: `${goalProgress}%` }} /></div>
          <small>{goalProgress}% da meta concluída</small>
        </div>
      </section>

      <section className="executive-kpi-grid full-span" aria-label="Indicadores executivos">
        <article><span>Receita hoje</span><strong>{currency(todayRevenue)}</strong><small>Entrada registrada no dia</small></article>
        <article><span>Receita mês</span><strong>{currency(monthRevenue)}</strong><small>Entradas no mês atual</small></article>
        <article><span>Lucro líquido</span><strong>{currency(netProfit)}</strong><small>Receita - despesas - comissões</small></article>
        <article><span>Ticket médio</span><strong>{currency(averageTicket)}</strong><small>Média por atendimento</small></article>
        <article><span>Retenção</span><strong>{retentionRate}%</strong><small>Clientes com retorno</small></article>
        <article><span>Previsão</span><strong>{currency(forecast)}</strong><small>Projeção com agenda ativa</small></article>
      </section>

      <section className="executive-grid full-span">
        <article className="panel-card executive-chart-card">
          <h2>Fluxo de caixa simplificado</h2>
          <p className="panel-help">Comparativo direto entre entradas, saídas, comissões e lucro estimado.</p>
          <div className="cash-bars">
            {[{ label: 'Receita', value: monthRevenue }, { label: 'Despesas', value: monthExpenses }, { label: 'Comissões', value: commissionTotal }, { label: 'Lucro', value: Math.max(0, netProfit) }].map((item) => {
              const max = Math.max(monthRevenue, monthExpenses, commissionTotal, Math.max(0, netProfit), 1);
              return <div key={item.label}><span>{item.label}</span><b style={{ width: `${Math.max(6, Math.round((item.value / max) * 100))}%` }} /><strong>{currency(item.value)}</strong></div>;
            })}
          </div>
        </article>

        <article className="panel-card executive-insights-card">
          <h2>Insight executivo</h2>
          <p className="panel-help">Sinais automáticos para tomada de decisão rápida.</p>
          <div className="executive-insights-list">
            {executiveInsights.map((item) => <span key={item}>{item}</span>)}
            {(insights?.suggestions || insights?.saved || []).slice(0, 2).map((item, index) => <span key={item.id || index}>{item.title || item.content}</span>)}
          </div>
        </article>
      </section>

      <section className="executive-grid full-span">
        <RankingCard title="Serviços que mais movimentam receita" items={serviceRanking} empty="Ainda não há serviços com receita calculável." />
        <RankingCard title="Profissionais em destaque" items={professionalRanking} empty="Ainda não há atendimentos suficientes para ranking." />
      </section>

      <section className="executive-actions panel-card full-span">
        <div><span className="eyebrow">Ações recomendadas</span><h2>Próximos passos para aumentar faturamento</h2></div>
        <div className="executive-action-grid">
          <button type="button" onClick={() => setTab('automations')}>Ativar campanha de retorno</button>
          <button type="button" onClick={() => setTab('financial')}>Lançar receita/despesa</button>
          <button type="button" onClick={() => setTab('commissions')}>Revisar comissões</button>
          <button type="button" onClick={() => setTab('assistant')}>Perguntar ao Assistente IA</button>
        </div>
      </section>
    </div>
  );
}

function RankingCard({ title, items, empty }) {
  return (
    <article className="panel-card executive-ranking-card">
      <h2>{title}</h2>
      <div className="executive-ranking-list">
        {items.map((item, index) => (
          <div key={item.name}>
            <b>{index + 1}</b>
            <span><strong>{item.name}</strong><small>{item.count} atendimento(s)</small></span>
            <em>{currency(item.revenue)}</em>
          </div>
        ))}
        {items.length === 0 && <p className="empty-state">{empty}</p>}
      </div>
    </article>
  );
}

function ServicesAdmin({ services, reload }) {
  const emptyForm = { name: '', description: '', price: '', durationMin: '', imageUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(service) {
    setEditingId(service.id);
    setForm({
      name: service.name || '',
      description: service.description || '',
      price: String(service.price ?? ''),
      durationMin: String(service.durationMin ?? ''),
      imageUrl: service.imageUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveService() {
    const url = editingId ? `/admin/services/${editingId}` : '/admin/services';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar serviço' : 'Cadastrar serviço'} onSubmit={saveService} submitLabel={editingId ? 'Atualizar serviço' : 'Salvar serviço'}>
      <ImageInput label="Imagem do serviço" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} />
      <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
      <Textarea label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
      <Input label="Preço" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} required />
      <Input label="Duração em minutos" type="number" value={form.durationMin} onChange={(durationMin) => setForm({ ...form, durationMin })} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={services}
        render={(s) => `${s.name} • ${currency(s.price)} • ${s.durationMin} min`}
        thumbnail={(s) => s.imageUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/services/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

function ProfessionalsAdmin({ professionals, reload }) {
  const emptyForm = { name: '', specialty: '', bio: '', photoUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(professional) {
    setEditingId(professional.id);
    setForm({
      name: professional.name || '',
      specialty: professional.specialty || '',
      bio: professional.bio || '',
      photoUrl: professional.photoUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveProfessional() {
    const url = editingId ? `/admin/professionals/${editingId}` : '/admin/professionals';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar profissional' : 'Cadastrar profissional'} onSubmit={saveProfessional} submitLabel={editingId ? 'Atualizar profissional' : 'Salvar profissional'}>
      <ImageInput label="Foto do profissional" value={form.photoUrl} onChange={(photoUrl) => setForm({ ...form, photoUrl })} />
      <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
      <Input label="Especialidade" value={form.specialty} onChange={(specialty) => setForm({ ...form, specialty })} required />
      <Textarea label="Biografia" value={form.bio} onChange={(bio) => setForm({ ...form, bio })} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={professionals}
        render={(p) => `${p.name} • ${p.specialty}`}
        thumbnail={(p) => p.photoUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/professionals/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

function PortfolioAdmin({ portfolio, reload }) {
  const emptyForm = { title: '', description: '', imageUrl: '', category: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      category: item.category || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function savePortfolio() {
    const url = editingId ? `/admin/portfolio/${editingId}` : '/admin/portfolio';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar item da vitrine' : 'Adicionar trabalho na vitrine'} onSubmit={savePortfolio} submitLabel={editingId ? 'Atualizar vitrine' : 'Salvar na vitrine'}>
      <ImageInput label="Imagem da vitrine" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} required />
      <Input label="Título" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
      <Input label="Categoria" value={form.category} onChange={(category) => setForm({ ...form, category })} required />
      <Textarea label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={portfolio}
        render={(p) => `${p.title} • ${p.category}`}
        thumbnail={(p) => p.imageUrl}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/portfolio/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

function AppointmentsAdmin({ appointments, professionals, services, reload }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState('week');
  const [professionalId, setProfessionalId] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [message, setMessage] = useState('');

  /**
   * Agenda Enterprise — Fase 1
   * ------------------------------------------------------------------
   * Esta agenda substitui a visualização simples por uma experiência
   * operacional: visão diária, semanal, mensal e timeline por profissional.
   * Também prepara a base para reagendamento visual via drag and drop.
   */
  const hours = Array.from({ length: 13 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
  const noteColors = ['yellow', 'blue', 'pink', 'green', 'orange', 'purple'];

  const selected = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);

  const weekDays = useMemo(() => {
    const baseDate = new Date(selected);
    const dayIndex = baseDate.getDay();
    const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        date,
        iso: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
        day: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      };
    });
  }, [selected]);

  const monthDays = useMemo(() => {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    const start = new Date(first);
    const startDay = start.getDay() || 7;
    start.setDate(first.getDate() - (startDay - 1));

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date,
        iso: date.toISOString().slice(0, 10),
        inMonth: date.getMonth() === selected.getMonth(),
        label: date.toLocaleDateString('pt-BR', { day: '2-digit' })
      };
    });
  }, [selected]);

  const normalizedAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => {
        const matchesProfessional = !professionalId || appointment.professionalId === professionalId || appointment.professional?.id === professionalId;
        return matchesProfessional;
      })
      .map((appointment) => ({
        ...appointment,
        dateIso: new Date(appointment.startTime).toISOString().slice(0, 10),
        hourKey: new Date(appointment.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).slice(0, 2) + ':00'
      }))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [appointments, professionalId]);

  const visibleAppointments = useMemo(() => {
    if (viewMode === 'day' || viewMode === 'timeline') {
      return normalizedAppointments.filter((appointment) => appointment.dateIso === selectedDate);
    }

    if (viewMode === 'month') {
      const month = selected.getMonth();
      const year = selected.getFullYear();
      return normalizedAppointments.filter((appointment) => {
        const date = new Date(appointment.startTime);
        return date.getMonth() === month && date.getFullYear() === year;
      });
    }

    const weekStart = weekDays[0]?.iso;
    const weekEnd = weekDays[6]?.iso;
    return normalizedAppointments.filter((appointment) => appointment.dateIso >= weekStart && appointment.dateIso <= weekEnd);
  }, [normalizedAppointments, selectedDate, selected, viewMode, weekDays]);

  const totalPotential = visibleAppointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const occupiedSlots = new Set(visibleAppointments.map((appointment) => `${appointment.professional?.id || appointment.professionalId}-${appointment.dateIso}-${appointment.hourKey}`)).size;
  const professionalsInView = professionalId ? professionals.filter((p) => p.id === professionalId) : professionals;
  const capacity = Math.max(1, professionalsInView.length * hours.length * (viewMode === 'week' ? 7 : 1));
  const occupancy = Math.min(100, Math.round((occupiedSlots / capacity) * 100));

  function serviceColor(appointment) {
    const serviceIndex = Math.abs(String(appointment.service?.id || appointment.serviceId || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
    return noteColors[serviceIndex % noteColors.length];
  }

  function appointmentsFor({ dateIso, hour, professional }) {
    return visibleAppointments.filter((appointment) => {
      const byDate = !dateIso || appointment.dateIso === dateIso;
      const byHour = !hour || appointment.hourKey === hour;
      const byProfessional = !professional || appointment.professionalId === professional.id || appointment.professional?.id === professional.id;
      return byDate && byHour && byProfessional;
    });
  }

  function moveDate(days) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + days);
    setSelectedDate(next.toISOString().slice(0, 10));
  }

  function moveMonth(months) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setMonth(next.getMonth() + months);
    setSelectedDate(next.toISOString().slice(0, 10));
  }

  async function handleDrop(event, { dateIso, hour, professional }) {
    event.preventDefault();
    if (!draggingId) return;

    const appointment = appointments.find((item) => item.id === draggingId);
    if (!appointment) return;

    const targetProfessional = professional || appointment.professional;
    const [hourNumber, minuteNumber] = hour.split(':').map(Number);
    const start = new Date(`${dateIso}T12:00:00`);
    start.setHours(hourNumber, minuteNumber, 0, 0);

    setMessage('Reagendando horário...');
    try {
      await request(`/admin/appointments/${appointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startTime: start.toISOString(),
          professionalId: targetProfessional?.id || appointment.professionalId,
          status: appointment.status || 'CONFIRMED'
        })
      });
      setMessage('Agendamento atualizado com sucesso.');
      setDraggingId('');
      await reload();
    } catch (err) {
      setMessage(err.message || 'Não foi possível reagendar.');
    }
  }

  function appointmentCard(appointment, compact = false) {
    const startTime = new Date(appointment.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endTime = appointment.endTime ? new Date(appointment.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <article
        className={`enterprise-event ${serviceColor(appointment)} ${compact ? 'compact' : ''}`}
        draggable
        onDragStart={() => setDraggingId(appointment.id)}
        onDragEnd={() => setDraggingId('')}
        key={appointment.id}
        title="Arraste para outro horário ou profissional"
      >
        <time>{startTime}{endTime ? ` - ${endTime}` : ''}</time>
        <strong>{appointment.clientName}</strong>
        <span>{appointment.service?.name || 'Serviço'}</span>
        {!compact && <small>{appointment.professional?.name || 'Profissional'} • {appointment.status}</small>}
      </article>
    );
  }

  return (
    <section className="panel-card enterprise-calendar-panel">
      <div className="enterprise-calendar-header full-span">
        <div>
          <span className="eyebrow">Agenda Enterprise</span>
          <h2>Calendário operacional do salão</h2>
          <p className="panel-help">Visualize por dia, semana, mês ou profissional. Arraste um agendamento para reagendar horário ou trocar o profissional.</p>
        </div>
        <div className="enterprise-calendar-kpis">
          <div><span>Agendamentos</span><strong>{visibleAppointments.length}</strong><small>no período</small></div>
          <div><span>Ocupação</span><strong>{occupancy}%</strong><small>capacidade estimada</small></div>
          <div><span>Potencial</span><strong>{currency(totalPotential)}</strong><small>em serviços</small></div>
        </div>
      </div>

      <div className="calendar-toolbar full-span">
        <div className="calendar-view-switch" role="tablist" aria-label="Alternar visualização da agenda">
          {[
            { key: 'day', label: 'Dia' },
            { key: 'week', label: 'Semana' },
            { key: 'month', label: 'Mês' },
            { key: 'timeline', label: 'Profissionais' }
          ].map((view) => (
            <button key={view.key} type="button" className={viewMode === view.key ? 'active' : ''} onClick={() => setViewMode(view.key)}>{view.label}</button>
          ))}
        </div>
        <div className="calendar-navigation">
          <button type="button" className="ghost-button" onClick={() => viewMode === 'month' ? moveMonth(-1) : moveDate(viewMode === 'day' || viewMode === 'timeline' ? -1 : -7)}>Anterior</button>
          <Input label="Data" type="date" value={selectedDate} onChange={setSelectedDate} />
          <button type="button" className="ghost-button" onClick={() => setSelectedDate(todayIso)}>Hoje</button>
          <button type="button" className="ghost-button" onClick={() => viewMode === 'month' ? moveMonth(1) : moveDate(viewMode === 'day' || viewMode === 'timeline' ? 1 : 7)}>Próximo</button>
        </div>
        <Select label="Profissional" value={professionalId} onChange={setProfessionalId} options={professionals.map((p) => ({ value: p.id, label: p.name }))} />
      </div>

      {message && <p className="feedback full-span">{message}</p>}

      {viewMode === 'day' && (
        <div className="calendar-day-grid full-span">
          <div className="calendar-time-rail">
            <span>Hora</span>
            {hours.map((hour) => <b key={hour}>{hour}</b>)}
          </div>
          <div className="calendar-day-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, professionalsInView.length)}, minmax(220px, 1fr))` }}>
            {professionalsInView.map((professional) => (
              <div className="calendar-professional-column" key={professional.id}>
                <header><strong>{professional.name}</strong><small>{professional.specialty}</small></header>
                {hours.map((hour) => (
                  <div className="calendar-slot" key={hour} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, { dateIso: selectedDate, hour, professional })}>
                    {appointmentsFor({ dateIso: selectedDate, hour, professional }).map((appointment) => appointmentCard(appointment))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="enterprise-week-board full-span">
          {weekDays.map((day) => (
            <article className="enterprise-week-column" key={day.iso}>
              <header><strong>{day.label}</strong><span>{day.day}</span></header>
              {hours.map((hour) => {
                const items = appointmentsFor({ dateIso: day.iso, hour });
                return (
                  <div className="enterprise-week-slot" key={`${day.iso}-${hour}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, { dateIso: day.iso, hour, professional: appointments.find((a) => a.id === draggingId)?.professional || professionalsInView[0] })}>
                    <time>{hour}</time>
                    <div>{items.length ? items.map((appointment) => appointmentCard(appointment, true)) : <span>Livre</span>}</div>
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      )}

      {viewMode === 'month' && (
        <div className="enterprise-month-board full-span">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <strong className="month-weekday" key={day}>{day}</strong>)}
          {monthDays.map((day) => {
            const items = normalizedAppointments.filter((appointment) => appointment.dateIso === day.iso).slice(0, 4);
            return (
              <article className={`month-cell ${day.inMonth ? '' : 'muted'}`} key={day.iso} onClick={() => { setSelectedDate(day.iso); setViewMode('day'); }}>
                <time>{day.label}</time>
                {items.map((appointment) => appointmentCard(appointment, true))}
                {normalizedAppointments.filter((appointment) => appointment.dateIso === day.iso).length > 4 && <small>+ mais</small>}
              </article>
            );
          })}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="enterprise-timeline full-span">
          {professionalsInView.map((professional) => {
            const items = visibleAppointments.filter((appointment) => appointment.professionalId === professional.id || appointment.professional?.id === professional.id);
            return (
              <article className="timeline-lane" key={professional.id}>
                <header><strong>{professional.name}</strong><small>{professional.specialty}</small></header>
                <div className="timeline-track">
                  {hours.map((hour) => (
                    <div className="timeline-slot" key={hour} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, { dateIso: selectedDate, hour, professional })}>
                      <time>{hour}</time>
                      {items.filter((appointment) => appointment.hourKey === hour).map((appointment) => appointmentCard(appointment, true))}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {visibleAppointments.length === 0 && <p className="empty-state full-span">Nenhum agendamento encontrado para o período selecionado.</p>}
    </section>
  );
}

function UsersAdmin({ users, reload }) {
  const emptyForm = { name: '', email: '', password: '', role: 'RECEPTION', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(user) {
    setEditingId(user.id);
    setForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'RECEPTION', active: user.active ?? true });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveUser() {
    const url = editingId ? `/admin/users/${editingId}` : '/admin/users';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    cancelEdit();
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar usuário' : 'Cadastrar usuário'} onSubmit={saveUser} submitLabel={editingId ? 'Atualizar usuário' : 'Salvar usuário'}>
      <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
      <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
      <Input label="Senha" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required={!editingId} />
      <Select label="Perfil" value={form.role} onChange={(role) => setForm({ ...form, role })} options={[{ value: 'ADMIN', label: 'Administrador' }, { value: 'RECEPTION', label: 'Recepção' }, { value: 'PROFESSIONAL', label: 'Profissional' }]} required />
      {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
      <EditableList
        items={users}
        render={(u) => `${u.name} • ${u.email} • ${u.role} • ${u.active ? 'ativo' : 'inativo'}`}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/users/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

function InventoryAdmin({ inventory, reload }) {
  const emptyForm = { name: '', category: '', supplier: '', unit: 'un', quantity: '', minimumQuantity: '', costPrice: '', salePrice: '', imageUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [movement, setMovement] = useState({ productId: '', type: 'IN', quantity: '', reason: '' });

  const lowStock = inventory.filter((product) => Number(product.quantity) <= Number(product.minimumQuantity));
  const totalCostValue = inventory.reduce((sum, product) => sum + (Number(product.quantity || 0) * Number(product.costPrice || 0)), 0);

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      category: product.category || '',
      supplier: product.supplier || '',
      unit: product.unit || 'un',
      quantity: String(product.quantity ?? ''),
      minimumQuantity: String(product.minimumQuantity ?? ''),
      costPrice: String(product.costPrice ?? ''),
      salePrice: product.salePrice == null ? '' : String(product.salePrice),
      imageUrl: product.imageUrl || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveProduct() {
    const url = editingId ? `/admin/inventory/${editingId}` : '/admin/inventory';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    cancelEdit();
    await reload();
  }

  async function createMovement(event) {
    event.preventDefault();
    await request('/admin/inventory/movements', { method: 'POST', body: JSON.stringify(movement) });
    setMovement({ productId: '', type: 'IN', quantity: '', reason: '' });
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary">
        <h2>Controle de estoque</h2>
        <p className="panel-help">Monitore produtos de uso interno, valores de custo e alertas de reposição.</p>
        <div className="mini-stats full-span">
          <div><span>Produtos</span><strong>{inventory.length}</strong></div>
          <div><span>Estoque baixo</span><strong>{lowStock.length}</strong></div>
          <div><span>Valor em custo</span><strong>{currency(totalCostValue)}</strong></div>
        </div>
      </section>

      <AdminCrud title={editingId ? 'Editar produto' : 'Cadastrar produto'} onSubmit={saveProduct} submitLabel={editingId ? 'Atualizar produto' : 'Salvar produto'}>
        <ImageInput label="Imagem do produto" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} />
        <Input label="Produto" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <Input label="Categoria" value={form.category} onChange={(category) => setForm({ ...form, category })} required />
        <Input label="Fornecedor" value={form.supplier} onChange={(supplier) => setForm({ ...form, supplier })} />
        <Input label="Unidade" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} required />
        <Input label="Quantidade atual" type="number" value={form.quantity} onChange={(quantity) => setForm({ ...form, quantity })} required />
        <Input label="Quantidade mínima" type="number" value={form.minimumQuantity} onChange={(minimumQuantity) => setForm({ ...form, minimumQuantity })} required />
        <Input label="Preço de custo" type="number" value={form.costPrice} onChange={(costPrice) => setForm({ ...form, costPrice })} required />
        <Input label="Preço de venda opcional" type="number" value={form.salePrice} onChange={(salePrice) => setForm({ ...form, salePrice })} />
        {editingId && <button type="button" className="ghost-button full" onClick={cancelEdit}>Cancelar edição</button>}
        <EditableList
          items={inventory}
          render={(p) => `${p.name} • ${p.quantity} ${p.unit} • mínimo ${p.minimumQuantity} • ${Number(p.quantity) <= Number(p.minimumQuantity) ? '⚠️ baixo' : 'ok'}`}
          thumbnail={(p) => p.imageUrl}
          onEdit={startEdit}
          onDelete={async (id) => { await request(`/admin/inventory/${id}`, { method: 'DELETE' }); await reload(); }}
        />
      </AdminCrud>

      <form className="panel-card form-grid" onSubmit={createMovement}>
        <h2>Movimentar estoque</h2>
        <Select label="Produto" value={movement.productId} onChange={(productId) => setMovement({ ...movement, productId })} options={inventory.map((p) => ({ value: p.id, label: `${p.name} - ${p.quantity} ${p.unit}` }))} required />
        <Select label="Tipo" value={movement.type} onChange={(type) => setMovement({ ...movement, type })} options={[{ value: 'IN', label: 'Entrada' }, { value: 'OUT', label: 'Saída' }, { value: 'ADJUSTMENT', label: 'Ajuste para quantidade exata' }]} required />
        <Input label="Quantidade" type="number" value={movement.quantity} onChange={(quantity) => setMovement({ ...movement, quantity })} required />
        <Input label="Motivo" value={movement.reason} onChange={(reason) => setMovement({ ...movement, reason })} required />
        <button className="primary full" type="submit">Registrar movimentação</button>
      </form>
    </div>
  );
}

function ClientsAdmin({ clients, reload }) {
  const emptyForm = { name: '', phone: '', email: '', birthDate: '', preferences: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(client) {
    setEditingId(client.id);
    setForm({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      birthDate: client.birthDate ? new Date(client.birthDate).toISOString().slice(0, 10) : '',
      preferences: client.preferences || '',
      notes: client.notes || ''
    });
  }

  async function saveClient() {
    const url = editingId ? `/admin/clients/${editingId}` : '/admin/clients';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    setEditingId(null);
    setForm(emptyForm);
    await reload();
  }

  return (
    <AdminCrud title={editingId ? 'Editar cliente' : 'Cadastrar cliente'} onSubmit={saveClient} submitLabel={editingId ? 'Atualizar cliente' : 'Salvar cliente'}>
      <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
      <Input label="WhatsApp" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} required />
      <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
      <Input label="Aniversário" type="date" value={form.birthDate} onChange={(birthDate) => setForm({ ...form, birthDate })} />
      <Textarea label="Preferências" value={form.preferences} onChange={(preferences) => setForm({ ...form, preferences })} />
      <Textarea label="Observações internas" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
      {editingId && <button type="button" className="ghost-button full" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar edição</button>}
      <EditableList
        items={clients}
        render={(client) => `${client.name} • ${client.phone} • ${client.email || 'sem e-mail'}`}
        onEdit={startEdit}
        onDelete={async (id) => { await request(`/admin/clients/${id}`, { method: 'DELETE' }); await reload(); }}
      />
    </AdminCrud>
  );
}

function FinancialAdmin({ financialEntries, reload }) {
  const emptyForm = { type: 'REVENUE', category: '', description: '', amount: '', paymentMethod: '', referenceDate: '', paid: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const revenue = financialEntries.filter((item) => item.type === 'REVENUE').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = financialEntries.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount || 0), 0);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ ...item, amount: String(item.amount || ''), referenceDate: item.referenceDate ? new Date(item.referenceDate).toISOString().slice(0, 10) : '' });
  }

  async function saveFinancialEntry() {
    const url = editingId ? `/admin/financial/${editingId}` : '/admin/financial';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    setEditingId(null);
    setForm(emptyForm);
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary">
        <h2>Financeiro executivo</h2>
        <p className="panel-help">Controle de receitas, despesas e caixa para avaliar lucro real do salão.</p>
        <div className="mini-stats full-span"><div><span>Receitas</span><strong>{currency(revenue)}</strong></div><div><span>Despesas</span><strong>{currency(expenses)}</strong></div><div><span>Resultado</span><strong>{currency(revenue - expenses)}</strong></div></div>
      </section>
      <AdminCrud title={editingId ? 'Editar lançamento' : 'Novo lançamento financeiro'} onSubmit={saveFinancialEntry} submitLabel={editingId ? 'Atualizar lançamento' : 'Salvar lançamento'}>
        <Select label="Tipo" value={form.type} onChange={(type) => setForm({ ...form, type })} options={[{ value: 'REVENUE', label: 'Receita' }, { value: 'EXPENSE', label: 'Despesa' }]} required />
        <Input label="Categoria" value={form.category} onChange={(category) => setForm({ ...form, category })} required />
        <Input label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
        <Input label="Valor" type="number" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required />
        <Input label="Forma de pagamento" value={form.paymentMethod || ''} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} />
        <Input label="Data" type="date" value={form.referenceDate || ''} onChange={(referenceDate) => setForm({ ...form, referenceDate })} />
        {editingId && <button type="button" className="ghost-button full" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar edição</button>}
        <EditableList items={financialEntries} render={(item) => `${item.type === 'REVENUE' ? 'Receita' : 'Despesa'} • ${item.category} • ${currency(item.amount)} • ${item.description}`} onEdit={startEdit} onDelete={async (id) => { await request(`/admin/financial/${id}`, { method: 'DELETE' }); await reload(); }} />
      </AdminCrud>
    </div>
  );
}

function CommissionsAdmin({ commissions, professionals, reload }) {
  const emptyForm = { professionalId: '', percentage: '40', notes: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const rules = commissions.rules || [];
  const projections = commissions.projections || [];
  const projectedTotal = projections.reduce((sum, item) => sum + Number(item.commission || 0), 0);

  function startEdit(rule) {
    setEditingId(rule.id);
    setForm({ professionalId: rule.professionalId, percentage: String(rule.percentage), notes: rule.notes || '', active: rule.active });
  }

  async function saveRule() {
    const url = editingId ? `/admin/commissions/rules/${editingId}` : '/admin/commissions/rules';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    setEditingId(null);
    setForm(emptyForm);
    await reload();
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary"><h2>Comissões</h2><p className="panel-help">Regras por profissional e projeção de pagamento com base na agenda.</p><div className="mini-stats full-span"><div><span>Regras</span><strong>{rules.length}</strong></div><div><span>Projeção</span><strong>{currency(projectedTotal)}</strong></div></div></section>
      <AdminCrud title={editingId ? 'Editar regra de comissão' : 'Cadastrar regra de comissão'} onSubmit={saveRule} submitLabel={editingId ? 'Atualizar regra' : 'Salvar regra'}>
        <Select label="Profissional" value={form.professionalId} onChange={(professionalId) => setForm({ ...form, professionalId })} options={professionals.map((p) => ({ value: p.id, label: p.name }))} required />
        <Input label="Percentual" type="number" value={form.percentage} onChange={(percentage) => setForm({ ...form, percentage })} required />
        <Input label="Observações" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        {editingId && <button type="button" className="ghost-button full" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar edição</button>}
        <EditableList items={rules} render={(rule) => `${rule.professional?.name || 'Profissional'} • ${rule.percentage}% • ${rule.active ? 'ativa' : 'inativa'}`} onEdit={startEdit} onDelete={async (id) => { await request(`/admin/commissions/rules/${id}`, { method: 'DELETE' }); await reload(); }} />
      </AdminCrud>
      <section className="panel-card full-span"><h2>Projeções por agendamento</h2><div className="list full-span">{projections.map((item) => <div className="list-row" key={item.appointmentId}><span>{item.professional} • {item.service} • {currency(item.baseValue)} → comissão {currency(item.commission)}</span></div>)}</div></section>
    </div>
  );
}

function LoyaltyAdmin({ loyalty, clients, reload }) {
  const program = loyalty.program || { name: 'Clube GlossFlow', pointsPerCurrency: 1, rewardDescription: '', active: true };
  const [programForm, setProgramForm] = useState({ name: program.name, pointsPerCurrency: String(program.pointsPerCurrency), rewardDescription: program.rewardDescription || '', active: program.active });
  const [entry, setEntry] = useState({ clientId: '', type: 'EARN', points: '', reason: '' });

  async function saveProgram() {
    await request('/admin/loyalty/program', { method: 'PUT', body: JSON.stringify(programForm) });
    await reload();
  }

  async function saveEntry(event) {
    event.preventDefault();
    await request('/admin/loyalty/entries', { method: 'POST', body: JSON.stringify(entry) });
    setEntry({ clientId: '', type: 'EARN', points: '', reason: '' });
    await reload();
  }

  return (
    <div className="inventory-layout">
      <AdminCrud title="Programa de fidelidade" onSubmit={saveProgram} submitLabel="Salvar programa">
        <Input label="Nome do programa" value={programForm.name} onChange={(name) => setProgramForm({ ...programForm, name })} required />
        <Input label="Pontos por R$ 1" type="number" value={programForm.pointsPerCurrency} onChange={(pointsPerCurrency) => setProgramForm({ ...programForm, pointsPerCurrency })} required />
        <Textarea label="Recompensa" value={programForm.rewardDescription} onChange={(rewardDescription) => setProgramForm({ ...programForm, rewardDescription })} required />
      </AdminCrud>
      <form className="panel-card form-grid" onSubmit={saveEntry}>
        <h2>Movimentar pontos</h2>
        <Select label="Cliente" value={entry.clientId} onChange={(clientId) => setEntry({ ...entry, clientId })} options={clients.map((c) => ({ value: c.id, label: c.name }))} required />
        <Select label="Tipo" value={entry.type} onChange={(type) => setEntry({ ...entry, type })} options={[{ value: 'EARN', label: 'Ganhar pontos' }, { value: 'REDEEM', label: 'Resgatar pontos' }, { value: 'ADJUSTMENT', label: 'Ajuste' }]} required />
        <Input label="Pontos" type="number" value={entry.points} onChange={(points) => setEntry({ ...entry, points })} required />
        <Input label="Motivo" value={entry.reason} onChange={(reason) => setEntry({ ...entry, reason })} required />
        <button className="primary full" type="submit">Registrar pontos</button>
        <div className="list full-span">{(loyalty.entries || []).map((item) => <div className="list-row" key={item.id}><span>{item.client?.name} • {item.type} • {item.points} pontos • {item.reason}</span></div>)}</div>
      </form>
    </div>
  );
}

function SubscriptionAdmin({ subscription, reload }) {
  const plans = subscription.plans || [];
  const current = subscription.subscription;

  /**
   * Matriz comercial do GlossFlow.
   * ------------------------------------------------------------
   * A área de assinatura foi redesenhada para deixar claro o que o
   * salão ganha no Trial e o que muda em cada plano pago. Essa clareza
   * reduz dúvidas comerciais e aproxima o produto de um SaaS real.
   */
  const planGuide = [
    {
      name: 'Trial',
      price: 'R$ 0',
      tag: 'Teste por tempo limitado',
      audience: 'Salões avaliando o sistema antes de contratar.',
      includes: ['Vitrine pública', 'Agenda básica', 'Cadastro de serviços', 'Cadastro de profissionais', 'Até 2 usuários', 'Dados demonstrativos'],
      limits: ['Sem automações reais de WhatsApp', 'Sem relatórios avançados', 'Sem múltiplas unidades'],
      highlight: current?.status === 'TRIAL'
    },
    {
      name: 'Start',
      price: 'R$ 79/mês',
      tag: 'Entrada profissional',
      audience: 'Salões pequenos que querem agendamento e vitrine.',
      includes: ['Tudo do Trial', 'Clientes reais', 'Estoque simples', 'Até 3 usuários', 'Suporte inicial', 'PWA instalável'],
      limits: ['Sem comissões avançadas', 'Sem IA gerencial completa'],
      highlight: false
    },
    {
      name: 'Profissional',
      price: 'R$ 149,90/mês',
      tag: 'Mais indicado',
      audience: 'Salões em operação diária com equipe e recorrência.',
      includes: ['Agenda completa', 'CRM de clientes', 'Financeiro', 'Comissões', 'Fidelidade', 'Automações de WhatsApp', 'Até 12 usuários'],
      limits: ['Uma unidade por assinatura'],
      highlight: current?.plan?.name === 'Profissional'
    },
    {
      name: 'Enterprise',
      price: 'Sob consulta',
      tag: 'Redes e franquias',
      audience: 'Redes com várias unidades, gestão central e auditoria.',
      includes: ['Multiunidade', 'Permissões avançadas', 'Auditoria', 'Relatórios executivos', 'Integrações', 'SLA e implantação assistida'],
      limits: ['Contrato personalizado'],
      highlight: current?.plan?.name === 'Enterprise'
    }
  ];

  const [form, setForm] = useState({
    planId: current?.planId || '',
    status: current?.status || 'TRIAL',
    endsAt: current?.endsAt ? new Date(current.endsAt).toISOString().slice(0, 10) : ''
  });

  const [newPlan, setNewPlan] = useState({ name: '', price: '', maxUsers: '', maxSalons: '1', features: '', active: true });

  async function saveSubscription() {
    await request('/admin/subscription', { method: 'PUT', body: JSON.stringify(form) });
    await reload();
  }

  async function createPlan(event) {
    event.preventDefault();
    await request('/admin/subscription/plans', { method: 'POST', body: JSON.stringify(newPlan) });
    setNewPlan({ name: '', price: '', maxUsers: '', maxSalons: '1', features: '', active: true });
    await reload();
  }

  return (
    <div className="subscription-center">
      <section className="panel-card full-span subscription-hero">
        <div>
          <span className="eyebrow">Planos e assinatura</span>
          <h2>Entenda exatamente o que cada versão oferece</h2>
          <p className="panel-help">O Trial serve para testar o GlossFlow com segurança. Os planos pagos liberam operação real, automações, gestão financeira e crescimento do salão.</p>
        </div>
        <div className="subscription-status-card">
          <span>Plano atual</span>
          <strong>{current?.plan?.name || 'Sem plano'}</strong>
          <small>Status: {current?.status || 'N/A'}</small>
        </div>
      </section>

      <section className="plan-grid full-span" aria-label="Comparativo visual dos planos">
        {planGuide.map((plan) => (
          <article className={plan.highlight ? 'plan-card featured' : 'plan-card'} key={plan.name}>
            <div className="plan-head">
              <span>{plan.tag}</span>
              <h3>{plan.name}</h3>
              <strong>{plan.price}</strong>
            </div>
            <p>{plan.audience}</p>
            <div className="plan-list">
              <small>Inclui</small>
              {plan.includes.map((item) => <span key={item}>✓ {item}</span>)}
            </div>
            <div className="plan-list muted-list">
              <small>Limites</small>
              {plan.limits.map((item) => <span key={item}>• {item}</span>)}
            </div>
          </article>
        ))}
      </section>

      <AdminCrud title="Atualizar assinatura do salão" onSubmit={saveSubscription} submitLabel="Atualizar assinatura">
        <Select label="Plano contratado" value={form.planId} onChange={(planId) => setForm({ ...form, planId })} options={plans.map((plan) => ({ value: plan.id, label: `${plan.name} - ${currency(plan.price)}/mês` }))} required />
        <Select label="Status comercial" value={form.status} onChange={(status) => setForm({ ...form, status })} options={[{ value: 'TRIAL', label: 'Trial / teste' }, { value: 'ACTIVE', label: 'Pago ativo' }, { value: 'PAST_DUE', label: 'Pagamento atrasado' }, { value: 'CANCELED', label: 'Cancelado' }]} required />
        <Input label="Fim do período" type="date" value={form.endsAt} onChange={(endsAt) => setForm({ ...form, endsAt })} />
        <div className="list full-span">
          {plans.map((plan) => <div className="list-row" key={plan.id}><span>{plan.name} • {currency(plan.price)} • até {plan.maxUsers} usuários • {plan.maxSalons} unidade(s)</span><p>{plan.features}</p></div>)}
        </div>
      </AdminCrud>

      <form className="panel-card form-grid" onSubmit={createPlan}>
        <h2>Criar novo plano comercial</h2>
        <p className="panel-help full-span">Use esta área para criar planos próprios do SaaS, como Start, Premium, Unidade Extra ou Enterprise.</p>
        <Input label="Nome do plano" value={newPlan.name} onChange={(name) => setNewPlan({ ...newPlan, name })} required />
        <Input label="Preço mensal" type="number" value={newPlan.price} onChange={(price) => setNewPlan({ ...newPlan, price })} required />
        <Input label="Máximo de usuários" type="number" value={newPlan.maxUsers} onChange={(maxUsers) => setNewPlan({ ...newPlan, maxUsers })} required />
        <Input label="Máximo de unidades" type="number" value={newPlan.maxSalons} onChange={(maxSalons) => setNewPlan({ ...newPlan, maxSalons })} required />
        <Textarea label="Recursos incluídos" value={newPlan.features} onChange={(features) => setNewPlan({ ...newPlan, features })} required />
        <button className="primary full" type="submit">Criar plano</button>
      </form>
    </div>
  );
}

function AIAssistantAdmin({ services, professionals, appointments, inventory, clients, financialEntries, insights }) {
  const quickPrompts = [
    'Quem são meus melhores clientes?',
    'Quais clientes estão sem retornar?',
    'Qual profissional mais faturou?',
    'Crie uma campanha para horários vagos.',
    'Quais produtos precisam de reposição?',
    'Como melhorar o faturamento deste mês?'
  ];

  const [question, setQuestion] = useState('Como está o desempenho do salão hoje?');
  const [answer, setAnswer] = useState(() => buildLocalAssistantAnswer('Como está o desempenho do salão hoje?', { services, professionals, appointments, inventory, clients, financialEntries, insights }));
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const profit = revenue - expenses;
  const lowStock = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0));
  const averageTicket = appointments.length ? appointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0) / appointments.length : 0;

  async function askAssistant(event) {
    event?.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    const snapshot = { services, professionals, appointments, inventory, clients, financialEntries, insights };
    const localAnswer = buildLocalAssistantAnswer(question, snapshot);

    try {
      const response = await request('/admin/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ question })
      });
      const finalAnswer = response?.answer || localAnswer;
      setAnswer(finalAnswer);
      setHistory((items) => [{ question, answer: finalAnswer, createdAt: new Date().toISOString() }, ...items].slice(0, 6));
    } catch (err) {
      setAnswer(localAnswer);
      setHistory((items) => [{ question, answer: localAnswer, createdAt: new Date().toISOString() }, ...items].slice(0, 6));
    } finally {
      setLoading(false);
    }
  }

  function usePrompt(prompt) {
    setQuestion(prompt);
    const localAnswer = buildLocalAssistantAnswer(prompt, { services, professionals, appointments, inventory, clients, financialEntries, insights });
    setAnswer(localAnswer);
    setHistory((items) => [{ question: prompt, answer: localAnswer, createdAt: new Date().toISOString() }, ...items].slice(0, 6));
  }

  return (
    <section className="ai-assistant-page">
      <div className="ai-hero panel-card full-span">
        <div>
          <span className="eyebrow">Fase 3 · IA operacional</span>
          <h2>Assistente IA do salão</h2>
          <p className="panel-help">Pergunte sobre clientes, agenda, faturamento, estoque, campanhas e oportunidades. A resposta usa os dados reais carregados no painel e já está preparada para integração com provedores de IA.</p>
        </div>
        <div className="ai-health-grid">
          <article><span>Receita</span><strong>{currency(revenue)}</strong></article>
          <article><span>Lucro</span><strong>{currency(profit)}</strong></article>
          <article><span>Ticket médio</span><strong>{currency(averageTicket)}</strong></article>
          <article><span>Alertas</span><strong>{lowStock.length}</strong></article>
        </div>
      </div>

      <div className="ai-workspace full-span">
        <section className="ai-chat panel-card">
          <form className="ai-question-box" onSubmit={askAssistant}>
            <label>
              <span>Pergunte ao GlossFlow</span>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex: quais clientes devo chamar esta semana?" />
            </label>
            <button className="primary" type="submit" disabled={loading}>{loading ? 'Analisando...' : 'Gerar resposta'}</button>
          </form>

          <article className="ai-answer" aria-live="polite">
            <div className="ai-avatar">AI</div>
            <div>
              <strong>Resposta recomendada</strong>
              <pre>{answer}</pre>
            </div>
          </article>
        </section>

        <aside className="ai-side panel-card">
          <h3>Perguntas rápidas</h3>
          <p>Use estes atalhos para tomar decisões sem procurar dados manualmente.</p>
          <div className="ai-prompt-list">
            {quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => usePrompt(prompt)}>{prompt}</button>)}
          </div>
        </aside>
      </div>

      <section className="ai-recommendations full-span">
        <article className="panel-card">
          <h3>Clientes em foco</h3>
          <p className="panel-help">Priorize clientes sem retorno, aniversariantes e clientes com maior recorrência.</p>
          <div className="ai-mini-list">
            {clients.slice(0, 5).map((client) => <span key={client.id}>{client.name} · {client.phone}</span>)}
            {clients.length === 0 && <span>Nenhum cliente cadastrado.</span>}
          </div>
        </article>
        <article className="panel-card">
          <h3>Campanhas sugeridas</h3>
          <p className="panel-help">Ideias de comunicação geradas a partir de agenda, serviços e estoque.</p>
          <div className="ai-mini-list">
            <span>Preencher horários vagos com combo de serviço rápido.</span>
            <span>Enviar retorno para clientes sem visita recente.</span>
            <span>Promover serviços com melhor margem e baixa ocupação.</span>
          </div>
        </article>
        <article className="panel-card">
          <h3>Histórico de perguntas</h3>
          <p className="panel-help">Últimas análises realizadas nesta sessão.</p>
          <div className="ai-mini-list">
            {history.map((item) => <span key={`${item.createdAt}-${item.question}`}>{item.question}</span>)}
            {history.length === 0 && <span>Nenhuma pergunta feita ainda.</span>}
          </div>
        </article>
      </section>
    </section>
  );
}

function buildLocalAssistantAnswer(question, data) {
  const normalized = question.toLowerCase();
  const revenue = data.financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = data.financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const profit = revenue - expenses;
  const lowStock = data.inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0));
  const topService = [...data.services].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];
  const appointmentsValue = data.appointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const avgTicket = data.appointments.length ? appointmentsValue / data.appointments.length : 0;

  if (normalized.includes('cliente')) {
    return [
      'Análise de clientes:',
      `• Base atual: ${data.clients.length} cliente(s).`,
      `• Ações recomendadas: segmentar clientes por recorrência, aniversário e último atendimento.`,
      `• Campanha sugerida: envie uma mensagem de retorno oferecendo um benefício em serviço de maior margem${topService ? `, como ${topService.name}` : ''}.`,
      '• Próximo passo: cadastre data de nascimento e preferência de serviço para melhorar a personalização.'
    ].join('\n');
  }

  if (normalized.includes('fatur') || normalized.includes('lucro') || normalized.includes('financeiro')) {
    return [
      'Análise financeira:',
      `• Receita registrada: ${currency(revenue)}.`,
      `• Despesas registradas: ${currency(expenses)}.`,
      `• Resultado estimado: ${currency(profit)}.`,
      `• Ticket médio da agenda: ${currency(avgTicket)}.`,
      profit < 0 ? '• Atenção: despesas acima das receitas. Revise estoque, comissão e promoções.' : '• Recomendação: crie meta semanal e promova serviços com ticket acima da média.'
    ].join('\n');
  }

  if (normalized.includes('produto') || normalized.includes('estoque') || normalized.includes('reposição')) {
    return [
      'Análise de estoque:',
      `• Produtos monitorados: ${data.inventory.length}.`,
      `• Produtos em alerta: ${lowStock.length}.`,
      lowStock.length ? `• Prioridade: ${lowStock.slice(0, 3).map((item) => item.name).join(', ')}.` : '• Nenhum produto abaixo do mínimo no momento.',
      '• Boa prática: conecte consumo de produto ao serviço realizado para prever reposição automaticamente.'
    ].join('\n');
  }

  if (normalized.includes('campanha') || normalized.includes('promo')) {
    return [
      'Campanha sugerida:',
      `• Objetivo: preencher horários vagos e aumentar ticket médio.`,
      `• Público: clientes cadastrados que ainda não retornaram ou fizeram serviços de baixo valor.`,
      `• Oferta: condição especial para ${topService?.name || 'o serviço mais estratégico do salão'}.`,
      '• Mensagem: "Olá {nome}! Temos horários selecionados esta semana com condição especial para você se cuidar. Quer reservar?"',
      '• Métrica: acompanhar respostas, agendamentos criados e receita recuperada.'
    ].join('\n');
  }

  if (normalized.includes('profissional')) {
    const ranking = data.professionals.map((professional) => {
      const total = data.appointments.filter((appointment) => appointment.professionalId === professional.id || appointment.professional?.id === professional.id).reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
      return { name: professional.name, total };
    }).sort((a, b) => b.total - a.total);
    return [
      'Análise por profissional:',
      ...ranking.slice(0, 5).map((item, index) => `• ${index + 1}. ${item.name}: ${currency(item.total)} em agenda.`),
      '• Recomendação: compare ocupação, ticket médio e recorrência antes de definir comissões ou metas.'
    ].join('\n');
  }

  return [
    'Resumo executivo do salão:',
    `• Serviços ativos: ${data.services.length}.`,
    `• Profissionais cadastrados: ${data.professionals.length}.`,
    `• Agendamentos registrados: ${data.appointments.length}.`,
    `• Receita registrada: ${currency(revenue)} e resultado estimado de ${currency(profit)}.`,
    `• Estoque em alerta: ${lowStock.length} produto(s).`,
    '• Próxima ação recomendada: revisar horários vagos, ativar campanhas de retorno e acompanhar ticket médio por profissional.'
  ].join('\n');
}

function AutomationsAdmin({ whatsappTemplates, insights, reload }) {
  const emptyForm = { name: '', event: 'APPOINTMENT_CREATED', message: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  /**
   * Central de Automações — versão operacional.
   * ------------------------------------------------------------
   * Agora o usuário pode criar automações do zero, usar modelos prontos,
   * editar templates existentes, excluir automações e entender quando cada
   * mensagem será disparada. O foco é reduzir a sensação de ferramenta técnica.
   */
  const automationCards = [
    { title: 'Confirmação automática', event: 'APPOINTMENT_CREATED', status: 'Essencial', metric: 'Agora', description: 'Envia uma mensagem assim que o cliente reserva um horário.', example: 'Olá {nome}! Seu horário para {servico} foi confirmado para {data} às {hora}. ✨' },
    { title: 'Lembrete antes do horário', event: 'REMINDER', status: 'Reduz faltas', metric: '24h', description: 'Lembra o cliente antes do atendimento para reduzir no-show.', example: 'Olá {nome}, passando para lembrar do seu atendimento amanhã às {hora}. Esperamos você!' },
    { title: 'Pós-atendimento', event: 'AFTER_SERVICE', status: 'Relacionamento', metric: '+Avaliações', description: 'Pede avaliação e reforça o vínculo após o serviço.', example: 'Oi {nome}! Como foi sua experiência hoje? Sua opinião ajuda nosso salão a melhorar. 💜' },
    { title: 'Cliente inativo', event: 'INACTIVE_CLIENT', status: 'Recuperação', metric: '30 dias', description: 'Convida clientes que não retornam há algum tempo.', example: 'Sentimos sua falta, {nome}! Temos uma condição especial para você voltar esta semana.' },
    { title: 'Aniversariantes', event: 'BIRTHDAY', status: 'Encantamento', metric: '10%', description: 'Envia felicitação e benefício de aniversário.', example: 'Feliz aniversário, {nome}! Você ganhou 10% de desconto para se cuidar com a gente. 🎉' },
    { title: 'Promoções inteligentes', event: 'PROMOTION', status: 'Campanha', metric: 'CRM', description: 'Ajuda a preencher horários vazios com ofertas segmentadas.', example: 'Temos horários livres hoje para {servico}. Quer garantir uma condição especial?' },
    { title: 'Pedido de retorno', event: 'REVIEW_REQUEST', status: 'Reputação', metric: 'Google', description: 'Convida o cliente a avaliar o salão depois do atendimento.', example: 'Sua avaliação é muito importante. Pode contar como foi sua experiência no salão?' },
    { title: 'Falta / no-show', event: 'NO_SHOW', status: 'Reagendar', metric: 'Recuperar', description: 'Envia mensagem educada para tentar reagendar uma falta.', example: 'Oi {nome}, vimos que você não conseguiu vir. Quer reagendar para outro horário?' }
  ];

  const selectedAutomation = automationCards.find((card) => card.event === form.event) || automationCards[0];
  const templateCount = whatsappTemplates.length;
  const activeTemplates = whatsappTemplates.filter((template) => template.active !== false).length;
  const insightItems = [...(insights.saved || []), ...(insights.suggestions || [])];

  async function saveTemplate() {
    const url = editingId ? `/admin/whatsapp/templates/${editingId}` : '/admin/whatsapp/templates';
    const method = editingId ? 'PUT' : 'POST';
    await request(url, { method, body: JSON.stringify(form) });
    setEditingId(null);
    setForm(emptyForm);
    await reload();
  }

  function applyPreset(card) {
    setEditingId(null);
    setForm({ name: card.title, event: card.event, message: card.example, active: true });
  }

  function startEdit(template) {
    setEditingId(template.id);
    setForm({ name: template.name || '', event: template.event || 'APPOINTMENT_CREATED', message: template.message || '', active: template.active !== false });
  }

  function startBlank() {
    setEditingId(null);
    setForm(emptyForm);
    setTimeout(() => document.querySelector('.automation-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  return (
    <div className="automation-center">
      <section className="automation-hero panel-card full-span">
        <div>
          <span className="eyebrow">Central inteligente</span>
          <h2>Crie, edite e acompanhe automações do salão</h2>
          <p>Escolha um modelo pronto ou crie uma automação do zero. Cada template representa uma mensagem que poderá ser conectada ao WhatsApp real na etapa de integração.</p>
          <div className="automation-actions">
            <button type="button" className="primary" onClick={startBlank}>Criar automação do zero</button>
            <button type="button" className="secondary" onClick={() => document.querySelector('.saved-automations')?.scrollIntoView({ behavior: 'smooth' })}>Ver automações salvas</button>
          </div>
        </div>
        <div className="automation-scoreboard" aria-label="Indicadores de automação">
          <article><strong>{templateCount}</strong><span>templates criados</span></article>
          <article><strong>{activeTemplates}</strong><span>ativos</span></article>
          <article><strong>{insightItems.length}</strong><span>insights</span></article>
        </div>
      </section>

      <section className="automation-builder panel-card full-span" aria-label="Construtor visual de automações">
        <div className="builder-copy">
          <span className="eyebrow">Construtor visual</span>
          <h2>Monte a jornada do cliente sem configuração técnica</h2>
          <p>Use os blocos abaixo como um fluxo real de automação. Cada etapa representa um momento do relacionamento com o cliente e pode ser ligada a um template salvo.</p>
        </div>
        <div className="builder-canvas" role="list" aria-label="Fluxo recomendado de automação">
          {[
            { icon: '📅', label: 'Agendamento', text: 'Cliente reserva horário', event: 'APPOINTMENT_CREATED' },
            { icon: '✅', label: 'Confirmação', text: 'Mensagem imediata', event: 'APPOINTMENT_CREATED' },
            { icon: '⏰', label: 'Lembrete', text: '24h antes do atendimento', event: 'REMINDER' },
            { icon: '💇', label: 'Atendimento', text: 'Serviço realizado', event: 'AFTER_SERVICE' },
            { icon: '⭐', label: 'Avaliação', text: 'Pedido de feedback', event: 'REVIEW_REQUEST' },
            { icon: '🎁', label: 'Retorno', text: 'Fidelidade e promoção', event: 'INACTIVE_CLIENT' }
          ].map((node, index, list) => (
            <React.Fragment key={`${node.event}-${index}`}>
              <button type="button" className={form.event === node.event ? 'workflow-node active' : 'workflow-node'} onClick={() => {
                const preset = automationCards.find((card) => card.event === node.event);
                if (preset) applyPreset(preset);
              }}>
                <span>{node.icon}</span>
                <strong>{node.label}</strong>
                <small>{node.text}</small>
              </button>
              {index < list.length - 1 && <div className="workflow-connector" aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
        <aside className="builder-guide">
          <strong>Como usar</strong>
          <ol>
            <li>Clique em um bloco do fluxo.</li>
            <li>Edite a mensagem no painel abaixo.</li>
            <li>Salve e deixe ativa ou pausada.</li>
          </ol>
          <p>Variáveis aceitas: <code>{`{nome}`}</code>, <code>{`{servico}`}</code>, <code>{`{data}`}</code> e <code>{`{hora}`}</code>.</p>
        </aside>
      </section>

      <section className="automation-playbook full-span" aria-label="Como usar automações">
        <article><strong>1</strong><span>Escolha um bloco</span><small>Clique no fluxo visual ou use um modelo pronto de campanha.</small></article>
        <article><strong>2</strong><span>Personalize a mensagem</span><small>Use variáveis do cliente para criar comunicação profissional.</small></article>
        <article><strong>3</strong><span>Ative e acompanhe</span><small>Gerencie status, edite templates e acompanhe insights.</small></article>
      </section>

      <section className="automation-grid full-span">
        {automationCards.map((card) => (
          <article className={form.event === card.event ? 'automation-card active' : 'automation-card'} key={card.event}>
            <div className="automation-card-header"><span>{card.metric}</span><small>{card.status}</small></div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <button type="button" className="ghost-button" onClick={() => applyPreset(card)}>Usar modelo</button>
          </article>
        ))}
      </section>

      <section className="automation-editor panel-card full-span">
        <AdminCrud title={editingId ? 'Editar automação' : 'Criar nova automação'} onSubmit={saveTemplate} submitLabel={editingId ? 'Atualizar automação' : 'Salvar automação'}>
          <Input label="Nome da automação" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Select label="Quando enviar" value={form.event} onChange={(event) => setForm({ ...form, event })} options={automationCards.map((card) => ({ value: card.event, label: card.title }))} required />
          <Textarea label="Mensagem para o cliente" value={form.message} onChange={(message) => setForm({ ...form, message })} required />
          <Select label="Status" value={String(form.active)} onChange={(active) => setForm({ ...form, active: active === 'true' })} options={[{ value: 'true', label: 'Ativa' }, { value: 'false', label: 'Pausada' }]} />
          {editingId && <button type="button" className="ghost-button full" onClick={startBlank}>Cancelar edição</button>}
        </AdminCrud>
        <aside className="phone-preview" aria-label="Prévia da mensagem no WhatsApp">
          <div className="phone-topbar"><span /> WhatsApp Preview</div>
          <div className="phone-bubble"><strong>{form.name || selectedAutomation.title}</strong><p>{form.message || selectedAutomation.example}</p></div>
          <small>Prévia visual. O envio real depende da integração com Evolution API, Twilio, Z-API ou outro provedor.</small>
        </aside>
      </section>

      <section className="panel-card full-span saved-automations">
        <h2>Automações salvas</h2>
        <p className="panel-help">Gerencie os templates já cadastrados. Você pode editar, pausar ou excluir modelos sem mexer no código.</p>
        <div className="list full-span">
          {whatsappTemplates.map((template) => (
            <div className="list-row editable-row" key={template.id}>
              <div><strong>{template.name}</strong><span>{template.event} • {template.active === false ? 'Pausada' : 'Ativa'}</span></div>
              <p>{template.message}</p>
              <div className="row-actions">
                <button type="button" className="edit-button" onClick={() => startEdit(template)}>Editar</button>
                <button type="button" className="danger-button" onClick={async () => { await request(`/admin/whatsapp/templates/${template.id}`, { method: 'DELETE' }); await reload(); }}>Excluir</button>
              </div>
            </div>
          ))}
          {whatsappTemplates.length === 0 && <p className="empty-state full-span">Nenhuma automação cadastrada ainda. Clique em “Criar automação do zero” ou use um modelo pronto.</p>}
        </div>
      </section>

      <section className="panel-card full-span">
        <h2>Insights gerenciais</h2>
        <p className="panel-help">Regras locais simulam recomendações de IA. Em produção, este módulo pode usar OpenAI, filas, webhooks e análise de histórico do salão.</p>
        <div className="insight-grid">
          {insightItems.map((item, index) => (
            <article className="insight-card" key={item.id || index}><small>{item.priority || 'MEDIUM'} • {item.category}</small><strong>{item.title}</strong><p>{item.content}</p></article>
          ))}
          {insightItems.length === 0 && <p className="empty-state full-span">Nenhum insight disponível no momento.</p>}
        </div>
      </section>
    </div>
  );
}


function SecurityAdmin({ clients, reload }) {
  const [overview, setOverview] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState({ clientId: '', type: 'MARKETING_WHATSAPP', granted: true, evidence: 'Consentimento registrado pelo painel administrativo.' });

  async function loadSecurity() {
    const [overviewData, logsData, sessionsData] = await Promise.all([
      request('/admin/security/overview'),
      request('/admin/security/audit-logs'),
      request('/admin/security/sessions')
    ]);
    setOverview(overviewData);
    setAuditLogs(logsData);
    setSessions(sessionsData);
  }

  useEffect(() => { loadSecurity().catch((err) => setMessage(err.message)); }, []);

  async function createBackup() {
    const backup = await request('/admin/security/backups', { method: 'POST', body: JSON.stringify({}) });
    setMessage(`Backup lógico criado: ${backup.summary}`);
    await loadSecurity();
  }

  async function revokeSession(id) {
    await request(`/admin/security/sessions/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
    await loadSecurity();
  }

  async function saveConsent(event) {
    event.preventDefault();
    await request('/admin/security/lgpd/consents', { method: 'POST', body: JSON.stringify(consent) });
    setMessage('Consentimento LGPD registrado com sucesso.');
    await loadSecurity();
  }

  return (
    <section className="security-center">
      <div className="panel-card security-hero full-span">
        <div>
          <span className="eyebrow">Segurança corporativa</span>
          <h2>Auditoria, sessões, LGPD e backup</h2>
          <p className="panel-help">Esta área transforma o GlossFlow em uma base mais preparada para operação comercial, com rastreabilidade, controle de sessão e governança de dados.</p>
        </div>
        <div className="security-score"><strong>{overview?.score || 0}</strong><span>score de segurança</span></div>
      </div>

      {message && <p className="feedback full-span">{message}</p>}

      <div className="security-grid full-span">
        {(overview?.controls || []).map((control) => (
          <article className="security-control" key={control.name}>
            <span>{control.status}</span>
            <strong>{control.name}</strong>
            <p>{control.description}</p>
          </article>
        ))}
      </div>

      <section className="panel-card full-span">
        <h2>Backup lógico</h2>
        <p className="panel-help">Gera um registro de snapshot operacional. Para produção, conecte esta etapa a backup real do MongoDB Atlas ou storage externo.</p>
        <button className="primary" type="button" onClick={createBackup}>Criar backup agora</button>
        {overview?.lastBackup && <p className="panel-help">Último backup: {overview.lastBackup.summary}</p>}
      </section>

      <form className="panel-card form-grid full-span" onSubmit={saveConsent}>
        <h2>Consentimento LGPD</h2>
        <Select label="Cliente" value={consent.clientId} onChange={(clientId) => setConsent({ ...consent, clientId })} options={clients.map((client) => ({ value: client.id, label: `${client.name} • ${client.phone}` }))} />
        <Input label="Tipo de consentimento" value={consent.type} onChange={(type) => setConsent({ ...consent, type })} required />
        <Textarea label="Evidência" value={consent.evidence} onChange={(evidence) => setConsent({ ...consent, evidence })} />
        <button className="primary full" type="submit">Registrar consentimento</button>
      </form>

      <section className="panel-card full-span">
        <h2>Sessões administrativas</h2>
        <div className="list">
          {sessions.map((session) => (
            <div className="list-row" key={session.id}>
              <div><strong>{session.user?.name || 'Usuário'}</strong><span>{session.ip || 'IP não informado'} • {session.revokedAt ? 'Revogada' : 'Ativa'}</span></div>
              <button className="danger-button" type="button" onClick={() => revokeSession(session.id)} disabled={Boolean(session.revokedAt)}>Encerrar sessão</button>
            </div>
          ))}
          {sessions.length === 0 && <p className="empty-state">Nenhuma sessão registrada.</p>}
        </div>
      </section>

      <section className="panel-card full-span">
        <h2>Auditoria recente</h2>
        <div className="audit-table">
          {auditLogs.slice(0, 30).map((log) => (
            <article key={log.id}>
              <strong>{log.action} • {log.resource}</strong>
              <span>{log.path}</span>
              <small>{new Date(log.createdAt).toLocaleString('pt-BR')} • {log.ip}</small>
            </article>
          ))}
          {auditLogs.length === 0 && <p className="empty-state">Nenhuma ação administrativa registrada ainda.</p>}
        </div>
      </section>
    </section>
  );
}

function PWAAdmin() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const beforeInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <section className="pwa-center">
      <div className="panel-card pwa-hero full-span">
        <div>
          <span className="eyebrow">PWA real</span>
          <h2>Instale o GlossFlow no celular, tablet ou desktop</h2>
          <p className="panel-help">A aplicação agora registra service worker, possui manifest avançado e cache básico para experiência mais próxima de aplicativo.</p>
        </div>
        <div className="pwa-status"><strong>{online ? 'Online' : 'Offline'}</strong><span>Status atual</span></div>
      </div>
      <div className="pwa-grid full-span">
        <article><strong>Instalação</strong><p>Use o botão abaixo ou o menu do navegador para adicionar o GlossFlow à tela inicial.</p><button className="primary" type="button" onClick={installApp} disabled={!installPrompt}>Instalar aplicativo</button></article>
        <article><strong>Offline parcial</strong><p>A vitrine e a estrutura principal ficam em cache; áreas administrativas continuam exigindo conexão para segurança.</p></article>
        <article><strong>Mobile-first</strong><p>Ideal para recepção, dono do salão e consulta rápida em tablet.</p></article>
      </div>
    </section>
  );
}


function EcosystemAdmin() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setData(await request('/admin/ecosystem/integrations'));
  }

  useEffect(() => { load().catch((err) => setMessage(err.message)); }, []);

  async function testIntegration(key) {
    const result = await request(`/admin/ecosystem/integrations/${key}/test`, { method: 'POST', body: JSON.stringify({}) });
    setMessage(result.message);
  }

  return (
    <section className="ecosystem-center">
      <div className="panel-card ecosystem-hero full-span">
        <div>
          <span className="eyebrow">Ecossistema conectado</span>
          <h2>Integrações reais para transformar o MVP em SaaS comercial</h2>
          <p className="panel-help">Conectores preparados para WhatsApp Business, pagamentos, calendário, imagens, IA, marketing e observabilidade. As chaves ficam no backend via variáveis de ambiente.</p>
        </div>
        <div className="ecosystem-score"><strong>{data?.connected || 0}/{data?.total || 0}</strong><span>conectadas</span></div>
      </div>

      {message && <p className="feedback full-span">{message}</p>}

      <div className="integration-grid full-span">
        {(data?.integrations || []).map((integration) => (
          <article className={`integration-card ${integration.status}`} key={integration.key}>
            <div>
              <span>{integration.category}</span>
              <strong>{integration.name}</strong>
              <p>{integration.description}</p>
              <small>Variável: {integration.env}</small>
            </div>
            <footer>
              <b>{integration.status === 'connected' ? 'Conectado' : 'Pronto para conectar'}</b>
              <button className="ghost-button" type="button" onClick={() => testIntegration(integration.key)}>Testar</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function ObservabilityAdmin() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setData(await request('/admin/observability/overview'));
  }

  useEffect(() => { load().catch((err) => setMessage(err.message)); }, []);

  const uptime = data?.uptimeSeconds ? `${Math.floor(data.uptimeSeconds / 60)} min` : '0 min';

  return (
    <section className="observability-center">
      <div className="panel-card observability-hero full-span">
        <div>
          <span className="eyebrow">Observabilidade</span>
          <h2>Saúde, performance e rastreabilidade do SaaS</h2>
          <p className="panel-help">Monitore API, latência, sessões, auditoria e sinais de negócio. Para produção, conecte Sentry, OpenTelemetry, Prometheus ou Datadog.</p>
        </div>
        <div className="observability-score"><strong>{data?.healthScore || 0}</strong><span>health score</span></div>
      </div>

      {message && <p className="feedback full-span">{message}</p>}

      <div className="observability-kpis full-span">
        <article><strong>{data?.serviceStatus || 'Carregando'}</strong><span>Status da API</span></article>
        <article><strong>{data?.averageLatency || 0}ms</strong><span>Latência média</span></article>
        <article><strong>{data?.totalRequests || 0}</strong><span>Requisições medidas</span></article>
        <article><strong>{data?.errorRate || 0}%</strong><span>Taxa de erro</span></article>
        <article><strong>{data?.memoryMb || 0}MB</strong><span>Memória</span></article>
        <article><strong>{uptime}</strong><span>Uptime</span></article>
      </div>

      <section className="panel-card full-span">
        <div className="section-inline-head"><h2>Rotas mais acessadas</h2><button className="secondary" type="button" onClick={load}>Atualizar</button></div>
        <div className="route-table">
          {(data?.routes || []).map((route) => (
            <article key={route.route}>
              <strong>{route.route}</strong>
              <span>{route.count} chamadas • {route.averageLatency}ms médio • {route.errors} erro(s)</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card full-span">
        <h2>Recomendações de operação</h2>
        <div className="recommendation-list">
          {(data?.recommendations || []).map((item) => <p key={item}>• {item}</p>)}
        </div>
      </section>
    </section>
  );
}

function UXPremiumAdmin({ setTab }) {
  const actions = [
    { title: 'Criar serviço', text: 'Abra o catálogo e cadastre um procedimento com imagem, preço e duração.', tab: 'services' },
    { title: 'Ver agenda', text: 'Analise dia, semana, mês ou timeline por profissional.', tab: 'appointments' },
    { title: 'Configurar automação', text: 'Use a jornada visual para ativar lembretes e relacionamento.', tab: 'automations' },
    { title: 'Perguntar à IA', text: 'Solicite campanhas, análise de clientes ou leitura financeira.', tab: 'assistant' },
    { title: 'Checar segurança', text: 'Revise sessões, auditoria, backups e LGPD.', tab: 'security' },
    { title: 'Conectar ecossistema', text: 'Veja as integrações prontas para ativação real.', tab: 'ecosystem' }
  ];

  return (
    <section className="ux-premium-center">
      <div className="panel-card ux-hero full-span">
        <div>
          <span className="eyebrow">UX de líder de mercado</span>
          <h2>Operação guiada, atalhos e menos carga cognitiva</h2>
          <p className="panel-help">Esta área transforma menus técnicos em tarefas de negócio. O objetivo é que o dono do salão saiba exatamente o próximo passo sem depender de treinamento longo.</p>
        </div>
      </div>
      <div className="quick-action-grid full-span">
        {actions.map((action) => (
          <button key={action.title} type="button" className="quick-action-card" onClick={() => setTab(action.tab)}>
            <strong>{action.title}</strong>
            <span>{action.text}</span>
          </button>
        ))}
      </div>
      <section className="panel-card full-span">
        <h2>Tour recomendado</h2>
        <div className="tour-steps">
          <article><b>1</b><span>Configure serviços, profissionais e vitrine.</span></article>
          <article><b>2</b><span>Valide a agenda enterprise e os horários disponíveis.</span></article>
          <article><b>3</b><span>Ative automações de confirmação, lembrete e retorno.</span></article>
          <article><b>4</b><span>Use IA, dashboard executivo e observabilidade para decisões semanais.</span></article>
        </div>
      </section>
    </section>
  );
}
