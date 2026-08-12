import React, { useEffect, useState } from 'react';
import { request } from '../../services/api';
import { Input, SectionTitle } from '../ui/Forms.jsx';

export function WhatsAppAgentTester({ setPage }) {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [phone, setPhone] = useState('5511999999999');
  const [clientName, setClientName] = useState('Cliente Teste');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function loadStatus() {
    try {
      const [agentStatus, operationalMetrics] = await Promise.all([
        request('/admin/whatsapp/agent-status'),
        request('/admin/whatsapp/metrics?days=30')
      ]);
      setStatus(agentStatus);
      setMetrics(operationalMetrics);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function send(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;

    const pendingId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessage('');
    setFeedback('');
    setChat((items) => [...items, { id: pendingId, role: 'client', text }]);
    setSending(true);

    try {
      const result = await request('/admin/whatsapp/agent-test', {
        method: 'POST',
        body: JSON.stringify({ phone, clientName, message: text })
      });
      setChat((items) => [...items, {
        id: `salon-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'salon',
        text: result.answer,
        salonName: result.salonName || status?.salon?.name || 'Salão'
      }]);
      setStatus((current) => current ? {
        ...current,
        aiProvider: result.provider || current.aiProvider,
        aiProviderLabel: result.providerLabel || current.aiProviderLabel,
        aiModel: result.model || current.aiModel
      } : current);
      const updatedMetrics = await request('/admin/whatsapp/metrics?days=30');
      setMetrics(updatedMetrics);
    } catch (error) {
      setChat((items) => items.filter((item) => item.id !== pendingId));
      setMessage(text);
      setFeedback(error.message);
    } finally {
      setSending(false);
    }
  }

  async function closeHandoff() {
    setFeedback('');
    try {
      await request(`/admin/whatsapp/handoffs/${encodeURIComponent(phone)}/close`, { method: 'POST' });
      setFeedback('Atendimento humano encerrado. O salão pode voltar a responder automaticamente este telefone.');
      setMetrics(await request('/admin/whatsapp/metrics?days=30'));
    } catch (error) {
      setFeedback(error.message);
    }
  }

  const providerLabel = status?.aiProviderLabel || (status?.aiProvider === 'groq' ? 'Groq' : 'OpenAI');
  const checks = status ? [
    [`IA · ${providerLabel}`, status.aiConfigured ?? status.openaiConfigured],
    ['Módulo WhatsApp', status.modules?.whatsapp],
    ['Módulo IA', status.modules?.ai],
    ['Módulo Agenda', status.modules?.agenda],
    ['Token WhatsApp', status.whatsappTokenConfigured],
    ['Phone Number ID', status.phoneNumberIdConfigured],
    ['Verify Token', status.webhookVerifyTokenConfigured],
    ['Assinatura Meta', status.webhookSignatureConfigured]
  ] : [];

  const operationalStats = metrics ? [
    ['Resolução automática', `${metrics.automaticResolutionRate || 0}%`],
    ['Contatos recebidos', metrics.uniqueInboundContacts || 0],
    ['Mensagens enviadas', metrics.messagesOut || 0],
    ['Falhas do provider', metrics.providerFailures || 0],
    ['Ações confirmadas', metrics.actionsCompleted || 0],
    ['Handoffs', metrics.handoffsOpened || 0]
  ] : [];

  const salonName = status?.salon?.name || 'Salão';

  return (
    <main className="container" style={{ maxWidth: 1120 }}>
      <SectionTitle
        label="WhatsApp · Homologação"
        title={`Teste o atendimento do ${salonName}`}
        text="Esta prévia simula o atendimento com dados reais do tenant. Mutações de Agenda viram propostas pendentes e só são executadas depois de uma confirmação explícita em mensagem posterior. Nenhuma mensagem é enviada para o provider nesta tela."
      />

      <section className="panel-card" style={{ marginBottom: 24 }}>
        <div className="hero-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow">Status da integração</span>
            <h2>{status?.salon?.name || 'Carregando salão...'}</h2>
          </div>
          <button className="secondary" type="button" onClick={() => setPage('admin')}>Voltar ao painel</button>
        </div>

        {status && (
          <div className="panel-help" style={{ marginTop: 16, padding: 14, borderRadius: 14 }}>
            <strong>Motor de IA:</strong> {providerLabel} &nbsp;•&nbsp; <strong>Modelo:</strong> <code>{status.aiModel || 'não informado'}</code>
            {status.backendRevision && <>&nbsp;•&nbsp; <strong>Backend:</strong> <code>{status.backendRevision}</code></>}
          </div>
        )}

        <div className="mini-stats full-span" style={{ marginTop: 18 }}>
          {checks.map(([label, ok]) => (
            <div key={label}><span>{label}</span><strong>{ok ? '✓ OK' : '○ pendente'}</strong></div>
          ))}
        </div>
        {status && <p className="panel-help">Modo atual: <strong>{status.dryRun ? 'dry-run / homologação' : 'produção'}</strong> • Webhook: <code>{status.webhookPath}</code></p>}
      </section>

      {metrics && (
        <section className="panel-card" style={{ marginBottom: 24 }} aria-label="Métricas de WhatsApp">
          <div className="hero-actions" style={{ justifyContent: 'space-between' }}>
            <div><span className="eyebrow">Últimos {metrics.periodDays || 30} dias</span><h2>Operação real do WhatsApp</h2></div>
            <button className="secondary" type="button" onClick={loadStatus}>Atualizar métricas</button>
          </div>
          <div className="mini-stats full-span" style={{ marginTop: 18 }}>
            {operationalStats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <p className="panel-help">Sucesso do provider: <strong>{metrics.providerSuccessRate || 0}%</strong> • propostas: {metrics.actionsProposed || 0} • canceladas: {metrics.actionsCanceled || 0} • falhas de ação: {metrics.actionsFailed || 0}.</p>
        </section>
      )}

      <div className="inventory-layout">
        <form className="panel-card form-grid" onSubmit={send}>
          <h2>Cliente simulado</h2>
          <Input label="Nome" value={clientName} onChange={setClientName} required />
          <Input label="WhatsApp de teste" value={phone} onChange={setPhone} required />
          <label className="field full-span">
            <span>Mensagem</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Ex.: Quanto custa corte? Tem horário amanhã à tarde?"
              required
            />
          </label>
          <button className="primary full" type="submit" disabled={sending}>{sending ? 'Consultando o salão...' : 'Enviar mensagem'}</button>
          <button className="secondary full" type="button" onClick={closeHandoff}>Encerrar atendimento humano deste telefone</button>
          {feedback && <p className="feedback full">{feedback}</p>}
        </form>

        <section className="panel-card">
          <span className="eyebrow">Conversa</span>
          <h2>Prévia do WhatsApp</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {chat.length === 0 && <p className="panel-help">Comece perguntando por um serviço, preço ou horário. Para validar uma ação, siga o fluxo proposta → CONFIRMAR.</p>}
            {chat.map((item, index) => (
              <div key={item.id || `${item.role}-${index}`} style={{ justifySelf: item.role === 'client' ? 'end' : 'start', maxWidth: '88%' }}>
                <div className={item.role === 'client' ? 'feedback' : 'panel-help'} style={{ padding: 14, borderRadius: 16, margin: 0, whiteSpace: 'pre-wrap' }}>
                  <strong>{item.role === 'client' ? 'Cliente' : (item.salonName || salonName)}</strong>
                  <br />{item.text}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
