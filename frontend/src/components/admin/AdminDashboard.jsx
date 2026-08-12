import React, { useMemo, useState } from 'react';
import { currency } from '../../utils/format.js';
import { dashboardMenuForRole, defaultDashboardTabForRole } from '../../config/role-access.js';
import { ROLES } from '../../utils/auth.js';
import { OnboardingChecklist, ExecutiveDashboard, AdvancedMetricsAdmin } from './AdminOverview.jsx';
import { ServicesAdmin, ProfessionalsAdmin, PortfolioAdmin } from './AdminCatalog.jsx';
import { UsersAdmin, InventoryAdmin, ClientsAdmin } from './AdminOperations.jsx';
import { FinancialAdmin, CommissionsAdmin, LoyaltyAdmin, SubscriptionAdmin } from './AdminFinance.jsx';
import { AutomationsAdmin, AIAssistantAdmin } from './AdminIntelligence.jsx';
import { SecurityAdmin, EcosystemAdmin, ObservabilityAdmin, UXPremiumAdmin, PWAAdmin } from './AdminPlatformModules.jsx';
import { AgendaEnterprise } from './AgendaEnterprise.jsx';

const MENU = [
  { key: 'executive', label: 'Dashboard', description: 'Receita, lucro e crescimento', icon: '📊' },
  { key: 'onboarding', label: 'Implantação Guiada', description: 'Configuração do salão', icon: '✅' },
  { key: 'analytics', label: 'Métricas Avançadas', description: 'Indicadores executivos', icon: '📈' },
  { key: 'services', label: 'Serviços', description: 'Preços, duração e imagens', icon: '✂' },
  { key: 'professionals', label: 'Profissionais', description: 'Equipe e especialidades', icon: '♛' },
  { key: 'portfolio', label: 'Vitrine', description: 'Galeria pública', icon: '◐' },
  { key: 'appointments', label: 'Agenda', description: 'Calendário enterprise', icon: '▦' },
  { key: 'inventory', label: 'Estoque', description: 'Produtos e reposição', icon: '▣' },
  { key: 'users', label: 'Usuários', description: 'Acessos e permissões', icon: '◉' },
  { key: 'clients', label: 'Clientes', description: 'CRM e fidelidade', icon: '◎' },
  { key: 'financial', label: 'Financeiro', description: 'Caixa, receita e despesa', icon: 'R$' },
  { key: 'commissions', label: 'Comissões', description: 'Regras e projeções', icon: '%' },
  { key: 'loyalty', label: 'Fidelidade', description: 'Pontos e recompensas', icon: '★' },
  { key: 'subscription', label: 'Assinatura', description: 'Planos do SaaS', icon: '◇' },
  { key: 'automations', label: 'Automações', description: 'WhatsApp e relacionamento', icon: '⚡' },
  { key: 'assistant', label: 'Assistente IA', description: 'Perguntas e decisões', icon: '🤖' },
  { key: 'security', label: 'Segurança', description: 'Auditoria, sessões e LGPD', icon: '🛡️' },
  { key: 'ecosystem', label: 'Ecossistema', description: 'Integrações', icon: '🔌' },
  { key: 'observability', label: 'Observabilidade', description: 'Saúde e métricas', icon: '📡' },
  { key: 'ux', label: 'UX Premium', description: 'Atalhos operacionais', icon: '✨' },
  { key: 'pwa', label: 'App/PWA', description: 'Instalação e offline', icon: '📱' }
];

/** Shell administrativo: navegação, indicadores e composição dos domínios. */
export function AdminDashboard({ role, salon, services, professionals, portfolio, appointments, inventory, users, clients, financialEntries, commissions, loyalty, subscription, whatsappTemplates, insights, reload, setPage, theme, toggleTheme }) {
  const allowedMenu = useMemo(() => dashboardMenuForRole(role, MENU), [role]);
  const [tab, setTab] = useState(() => defaultDashboardTabForRole(role));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [command, setCommand] = useState('');

  const stats = useMemo(() => [
    { label: 'Serviços ativos', value: services.length, hint: 'Catálogo do salão', icon: '✦' },
    { label: 'Profissionais', value: professionals.length, hint: 'Equipe cadastrada', icon: '◈' },
    { label: 'Agenda', value: appointments.length, hint: 'Reservas registradas', icon: '●' },
    { label: 'Estoque', value: inventory.length, hint: 'Produtos monitorados', icon: '■' },
    { label: 'Clientes', value: clients.length, hint: 'CRM e histórico', icon: '◎' },
    { label: 'Receita', value: currency(financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0)), hint: 'Financeiro registrado', icon: 'R$' }
  ], [appointments, clients, financialEntries, inventory, professionals, services]);

  const filteredMenu = useMemo(() => {
    const search = command.trim().toLowerCase();
    return search ? allowedMenu.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(search)) : allowedMenu;
  }, [allowedMenu, command]);

  const activeMenu = allowedMenu.find((item) => item.key === tab) || allowedMenu[0] || MENU[0];
  const professionalReadOnly = role === ROLES.PROFESSIONAL;

  function selectTab(nextTab) {
    if (allowedMenu.some((item) => item.key === nextTab)) setTab(nextTab);
  }

  function logout() {
    localStorage.removeItem('glossflow.token');
    localStorage.removeItem('glossflow.refreshToken');
    setPage('login');
  }

  return (
    <main className={`admin-pro-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} aria-label="Painel administrativo GlossFlow">
      <aside className="admin-pro-sidebar">
        <button className="admin-pro-brand" type="button" onClick={() => setPage('public')} aria-label="Voltar para vitrine pública">
          <span className="brand-mark">G</span><span><strong>GlossFlow</strong><small>{salon?.name || 'Admin'}</small></span>
        </button>
        <button className="sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label="Recolher ou expandir menu lateral">
          <span className="collapse-icon" aria-hidden="true">{sidebarCollapsed ? '›' : '‹'}</span><span className="collapse-label">{sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}</span>
        </button>
        <nav className="admin-pro-nav" aria-label="Módulos administrativos">
          <label className="global-command"><span>Busca rápida</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Buscar módulo..." /></label>
          {filteredMenu.map((item) => (
            <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)} title={item.label}>
              <span className="menu-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>
        <button className="admin-logout" type="button" onClick={logout}>Sair do painel</button>
      </aside>

      <section className="admin-pro-main">
        <header className="admin-pro-topbar">
          <div><span className="eyebrow">Painel operacional</span><h1>{activeMenu.label}</h1><p>{activeMenu.description}</p></div>
          <div className="topbar-actions">
            <button className="secondary" type="button" onClick={toggleTheme}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button>
            <button className="secondary" type="button" onClick={() => setPage('public')}>Ver vitrine</button>
            <button className="primary" type="button" onClick={reload}>Atualizar dados</button>
          </div>
        </header>

        {tab === 'executive' && <section className="admin-pro-stats" aria-label="Resumo administrativo">{stats.map((item) => <article className="pro-stat-card" key={item.label}><span className="pro-stat-icon">{item.icon}</span><div><strong>{item.value}</strong><span>{item.label}</span><small>{item.hint}</small></div></article>)}</section>}

        <section className="admin-pro-content">
          {tab === 'onboarding' && <OnboardingChecklist services={services} professionals={professionals} portfolio={portfolio} whatsappTemplates={whatsappTemplates} inventory={inventory} setTab={selectTab} />}
          {tab === 'executive' && <ExecutiveDashboard services={services} professionals={professionals} appointments={appointments} clients={clients} inventory={inventory} financialEntries={financialEntries} commissions={commissions} insights={insights} setTab={selectTab} />}
          {tab === 'analytics' && <AdvancedMetricsAdmin appointments={appointments} clients={clients} financialEntries={financialEntries} inventory={inventory} />}
          {tab === 'services' && <ServicesAdmin services={services} reload={reload} />}
          {tab === 'professionals' && <ProfessionalsAdmin professionals={professionals} reload={reload} />}
          {tab === 'portfolio' && <PortfolioAdmin portfolio={portfolio} reload={reload} />}
          {tab === 'appointments' && <AgendaEnterprise appointments={appointments} professionals={professionals} services={services} reload={reload} readOnly={professionalReadOnly} />}
          {tab === 'inventory' && <InventoryAdmin inventory={inventory} reload={reload} />}
          {tab === 'users' && <UsersAdmin users={users} reload={reload} />}
          {tab === 'clients' && <ClientsAdmin clients={clients} reload={reload} />}
          {tab === 'financial' && <FinancialAdmin financialEntries={financialEntries} reload={reload} />}
          {tab === 'commissions' && <CommissionsAdmin commissions={commissions} professionals={professionals} reload={reload} />}
          {tab === 'loyalty' && <LoyaltyAdmin loyalty={loyalty} clients={clients} reload={reload} />}
          {tab === 'subscription' && <SubscriptionAdmin subscription={subscription} reload={reload} />}
          {tab === 'automations' && <AutomationsAdmin whatsappTemplates={whatsappTemplates} insights={insights} reload={reload} />}
          {tab === 'assistant' && <AIAssistantAdmin services={services} professionals={professionals} appointments={appointments} inventory={inventory} clients={clients} financialEntries={financialEntries} insights={insights} />}
          {tab === 'security' && <SecurityAdmin clients={clients} />}
          {tab === 'ecosystem' && <EcosystemAdmin />}
          {tab === 'observability' && <ObservabilityAdmin />}
          {tab === 'ux' && <UXPremiumAdmin setTab={selectTab} />}
          {tab === 'pwa' && <PWAAdmin />}
        </section>
      </section>
    </main>
  );
}
