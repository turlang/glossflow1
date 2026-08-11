import React, { useMemo, useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';
import { AdminCrud, EditableList, Input, Select, Textarea } from '../ui/Forms.jsx';

const AUTOMATION_PRESETS = [
  { name: 'Confirmação automática', event: 'APPOINTMENT_CREATED', message: 'Olá {nome}! Seu horário para {servico} foi confirmado para {data} às {hora}.' },
  { name: 'Lembrete de horário', event: 'REMINDER', message: 'Olá {nome}, lembrando do seu atendimento em {data} às {hora}.' },
  { name: 'Pós-atendimento', event: 'AFTER_SERVICE', message: 'Oi {nome}! Como foi sua experiência? Sua opinião é muito importante.' },
  { name: 'Cliente inativo', event: 'INACTIVE_CLIENT', message: 'Sentimos sua falta, {nome}! Quer reservar um novo horário?' }
];

export function AutomationsAdmin({ whatsappTemplates, insights, reload }) {
  const emptyForm = { name: '', event: 'APPOINTMENT_CREATED', message: '', active: true };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(template) {
    setEditingId(template.id);
    setForm({ name: template.name || '', event: template.event || 'APPOINTMENT_CREATED', message: template.message || '', active: template.active !== false });
  }

  async function saveTemplate() {
    await request(editingId ? `/admin/whatsapp/templates/${editingId}` : '/admin/whatsapp/templates', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(form)
    });
    reset();
    await reload();
  }

  return (
    <div className="automation-center">
      <section className="automation-hero panel-card full-span">
        <div><span className="eyebrow">Central inteligente</span><h2>Automações do relacionamento</h2><p>Templates editáveis e preparados para o provider de WhatsApp do tenant.</p></div>
        <div className="automation-scoreboard"><article><strong>{whatsappTemplates.length}</strong><span>templates</span></article><article><strong>{whatsappTemplates.filter((template) => template.active !== false).length}</strong><span>ativos</span></article><article><strong>{(insights?.suggestions || []).length}</strong><span>insights</span></article></div>
      </section>
      <section className="automation-presets panel-card full-span">
        <h2>Modelos rápidos</h2>
        <div className="automation-card-grid">
          {AUTOMATION_PRESETS.map((preset) => <button key={preset.event} type="button" onClick={() => { setEditingId(null); setForm({ ...preset, active: true }); }}><strong>{preset.name}</strong><small>{preset.event}</small></button>)}
        </div>
      </section>
      <AdminCrud title={editingId ? 'Editar automação' : 'Criar automação'} onSubmit={saveTemplate} submitLabel={editingId ? 'Atualizar automação' : 'Salvar automação'}>
        <Input label="Nome" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} required />
        <Select label="Evento" value={form.event} onChange={(event) => setForm((current) => ({ ...current, event }))} options={AUTOMATION_PRESETS.map((preset) => ({ value: preset.event, label: preset.name }))} required />
        <Textarea label="Mensagem" value={form.message} onChange={(message) => setForm((current) => ({ ...current, message }))} required />
        {editingId && <button type="button" className="ghost-button full" onClick={reset}>Cancelar edição</button>}
        <EditableList items={whatsappTemplates} render={(template) => `${template.name} • ${template.event} • ${template.active !== false ? 'ativa' : 'inativa'}`} onEdit={startEdit} onDelete={async (id) => { await request(`/admin/whatsapp/templates/${id}`, { method: 'DELETE' }); await reload(); }} />
      </AdminCrud>
    </div>
  );
}

function buildLocalAssistantAnswer(question, data) {
  const normalized = question.toLowerCase();
  const revenue = data.financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenses = data.financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const lowStock = data.inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0));
  const agendaValue = data.appointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const averageTicket = data.appointments.length ? agendaValue / data.appointments.length : 0;

  if (normalized.includes('estoque') || normalized.includes('produto')) {
    return `Estoque: ${data.inventory.length} item(ns), ${lowStock.length} em alerta. Priorize ${lowStock.slice(0, 3).map((item) => item.name).join(', ') || 'nenhuma reposição crítica agora'}.`;
  }
  if (normalized.includes('cliente')) {
    return `CRM: ${data.clients.length} cliente(s). Segmente retorno, aniversário e preferência antes de disparar campanhas.`;
  }
  if (normalized.includes('fatur') || normalized.includes('lucro') || normalized.includes('financeiro')) {
    return `Receita ${currency(revenue)}, despesas ${currency(expenses)}, resultado ${currency(revenue - expenses)} e ticket médio de agenda ${currency(averageTicket)}.`;
  }
  return `Resumo: ${data.appointments.length} agendamento(s), ${data.professionals.length} profissional(is), ${data.clients.length} cliente(s), receita ${currency(revenue)} e ${lowStock.length} alerta(s) de estoque.`;
}

export function AIAssistantAdmin({ services, professionals, appointments, inventory, clients, financialEntries, insights }) {
  const [question, setQuestion] = useState('Como está o desempenho do salão hoje?');
  const snapshot = useMemo(() => ({ services, professionals, appointments, inventory, clients, financialEntries, insights }), [services, professionals, appointments, inventory, clients, financialEntries, insights]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const localAnswer = buildLocalAssistantAnswer(question, snapshot);

  async function askAssistant(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const response = await request('/admin/ai/assistant', { method: 'POST', body: JSON.stringify({ question }) });
      const finalAnswer = response?.answer || localAnswer;
      setAnswer(finalAnswer);
      setHistory((items) => [{ question, answer: finalAnswer, createdAt: Date.now() }, ...items].slice(0, 6));
    } catch {
      setAnswer(localAnswer);
      setHistory((items) => [{ question, answer: localAnswer, createdAt: Date.now() }, ...items].slice(0, 6));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-assistant-page">
      <div className="ai-hero panel-card full-span"><div><span className="eyebrow">IA operacional</span><h2>Assistente IA do salão</h2><p className="panel-help">O fallback local continua funcional mesmo se o provider externo estiver indisponível.</p></div></div>
      <div className="ai-workspace full-span">
        <section className="ai-chat panel-card">
          <form className="ai-question-box" onSubmit={askAssistant}>
            <label><span>Pergunte ao GlossFlow</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
            <button className="primary" type="submit" disabled={loading}>{loading ? 'Analisando...' : 'Gerar resposta'}</button>
          </form>
          <article className="ai-answer" aria-live="polite"><div className="ai-avatar">AI</div><div><strong>Resposta recomendada</strong><pre>{answer || localAnswer}</pre></div></article>
        </section>
        <aside className="ai-side panel-card"><h3>Histórico</h3><div className="ai-mini-list">{history.map((item) => <span key={item.createdAt}>{item.question}</span>)}{history.length === 0 && <span>Nenhuma pergunta feita ainda.</span>}</div></aside>
      </div>
    </section>
  );
}
