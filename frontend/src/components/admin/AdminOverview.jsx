import React, { useMemo } from 'react';
import { currency } from '../../utils/format.js';

export function OnboardingChecklist({ services, professionals, portfolio, whatsappTemplates, inventory, setTab }) {
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
        <p>Complete as etapas principais antes de ampliar automações e inteligência.</p>
      </div>
      <div className="onboarding-progress" aria-label={`${progress}% concluído`}>
        <strong>{progress}%</strong><span>configurado</span><div><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="onboarding-steps">
        {steps.map((step) => (
          <button key={step.label} type="button" className={step.done ? 'done' : ''} onClick={() => setTab(step.tab)}>
            <b>{step.done ? '✓' : '○'}</b><span><strong>{step.label}</strong><small>{step.help}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveDashboard({ services, professionals, appointments, clients, inventory, financialEntries, commissions, insights, setTab }) {
  const metrics = useMemo(() => {
    const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expenses = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const commissionTotal = (commissions?.projections || []).reduce((sum, item) => sum + Number(item.commission ?? item.commissionAmount ?? 0), 0);
    const agendaValue = appointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
    const averageTicket = appointments.length ? agendaValue / appointments.length : 0;
    const lowStock = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0));
    return { revenue, expenses, commissionTotal, net: revenue - expenses - commissionTotal, averageTicket, lowStock };
  }, [appointments, commissions, financialEntries, inventory]);

  return (
    <div className="executive-dashboard">
      <section className="executive-hero panel-card full-span">
        <div><span className="eyebrow">Dashboard Executivo</span><h2>Gestão financeira e operacional</h2><p className="panel-help">Indicadores de decisão sem misturar regra de negócio ao shell administrativo.</p></div>
      </section>
      <section className="executive-kpi-grid full-span" aria-label="Indicadores executivos">
        <article><span>Receita</span><strong>{currency(metrics.revenue)}</strong><small>lançamentos registrados</small></article>
        <article><span>Lucro líquido</span><strong>{currency(metrics.net)}</strong><small>após despesas e comissões</small></article>
        <article><span>Ticket médio</span><strong>{currency(metrics.averageTicket)}</strong><small>valor médio da agenda</small></article>
        <article><span>Clientes</span><strong>{clients.length}</strong><small>base de CRM</small></article>
        <article><span>Profissionais</span><strong>{professionals.length}</strong><small>equipe ativa</small></article>
        <article><span>Estoque baixo</span><strong>{metrics.lowStock.length}</strong><small>itens no limite</small></article>
      </section>
      <section className="executive-grid full-span">
        <article className="panel-card executive-insights-card">
          <h2>Prioridades operacionais</h2>
          <div className="executive-insights-list">
            <span>{services.length ? `${services.length} serviço(s) disponíveis para venda.` : 'Cadastre serviços antes de abrir a agenda.'}</span>
            <span>{metrics.lowStock.length ? `${metrics.lowStock.length} produto(s) precisam de reposição.` : 'Estoque sem alertas críticos.'}</span>
            {(insights?.suggestions || []).slice(0, 2).map((item, index) => <span key={item.id || index}>{item.title || item.content || String(item)}</span>)}
          </div>
        </article>
        <article className="panel-card executive-actions">
          <h2>Ações recomendadas</h2>
          <div className="executive-action-grid">
            <button type="button" onClick={() => setTab('appointments')}>Revisar agenda</button>
            <button type="button" onClick={() => setTab('automations')}>Ativar automações</button>
            <button type="button" onClick={() => setTab('financial')}>Conferir financeiro</button>
            <button type="button" onClick={() => setTab('assistant')}>Abrir Assistente IA</button>
          </div>
        </article>
      </section>
    </div>
  );
}

export function AdvancedMetricsAdmin({ appointments, clients, financialEntries, inventory }) {
  const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expense = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const confirmed = appointments.filter((appointment) => ['CONFIRMED', 'COMPLETED'].includes(appointment.status)).length;
  const cancellation = appointments.filter((appointment) => ['CANCELED', 'NO_SHOW'].includes(appointment.status)).length;
  const lowStock = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0)).length;

  return (
    <section className="panel-card full-span">
      <span className="eyebrow">Métricas avançadas</span>
      <h2>Leitura operacional consolidada</h2>
      <div className="executive-kpi-grid">
        <article><span>Receita</span><strong>{currency(revenue)}</strong></article>
        <article><span>Margem bruta</span><strong>{currency(revenue - expense)}</strong></article>
        <article><span>Atendimentos válidos</span><strong>{confirmed}</strong></article>
        <article><span>Cancelamentos/faltas</span><strong>{cancellation}</strong></article>
        <article><span>Clientes</span><strong>{clients.length}</strong></article>
        <article><span>Alertas estoque</span><strong>{lowStock}</strong></article>
      </div>
    </section>
  );
}
