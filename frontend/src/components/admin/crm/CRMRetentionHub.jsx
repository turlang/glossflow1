import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../../services/api.js';
import { ClientsAdmin } from '../AdminOperations.jsx';
import {
  buildRetentionKpis,
  filterRetentionClients,
  formatVisitRecency,
  RETENTION_LABELS,
  RETENTION_SEGMENTS,
  retentionPriorityClass
} from './crm-retention.utils.js';

const EMPTY_OVERVIEW = { summary: {}, clients: [] };

function historyDate(value) {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

/** Central do Marco 19: segmentação, retenção, consentimento e histórico. */
export function CRMRetentionHub({ clients, reload }) {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [segment, setSegment] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [busyClientId, setBusyClientId] = useState('');

  async function loadRetention() {
    setLoading(true);
    setError('');
    try {
      const data = await request('/admin/clients/retention');
      setOverview(data || EMPTY_OVERVIEW);
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar os indicadores de retenção.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRetention();
  }, []);

  const visibleClients = useMemo(
    () => filterRetentionClients(overview.clients || [], segment, query),
    [overview.clients, query, segment]
  );
  const kpis = useMemo(() => buildRetentionKpis(overview.summary), [overview.summary]);

  async function openHistory(clientId) {
    setHistoryLoading(true);
    setPrepared(null);
    try {
      setHistory(await request(`/admin/clients/${clientId}/history`));
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o histórico do cliente.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function changeMarketingPermission(client, granted) {
    setBusyClientId(client.id);
    setError('');
    try {
      await request(`/admin/clients/${client.id}/marketing-consent`, {
        method: 'POST',
        body: JSON.stringify({
          granted,
          evidence: granted ? 'Permissão registrada no CRM GlossFlow' : 'Opt-out registrado no CRM GlossFlow'
        })
      });
      await loadRetention();
    } catch (err) {
      setError(err?.message || 'Não foi possível atualizar a preferência de comunicação.');
    } finally {
      setBusyClientId('');
    }
  }

  async function prepareFollowUp(client) {
    setBusyClientId(client.id);
    setError('');
    try {
      const result = await request(`/admin/clients/${client.id}/follow-up`, { method: 'POST' });
      setPrepared({ client, ...result });
    } catch (err) {
      setError(err?.message || 'Não foi possível preparar o follow-up.');
    } finally {
      setBusyClientId('');
    }
  }

  function registerFollowUpInitiated(clientId) {
    void request(`/admin/clients/${clientId}/follow-up/contacted`, { method: 'POST' })
      .then(() => loadRetention())
      .catch((err) => setError(err?.message || 'O WhatsApp foi aberto, mas não foi possível registrar o follow-up no CRM.'));
  }

  return (
    <div className="crm-retention-shell">
      <section className="panel-card crm-retention-hero">
        <div>
          <span className="eyebrow">CRM e retenção</span>
          <h2>Quem precisa de atenção agora</h2>
          <p>Segmentações explicáveis por comportamento, aniversário e tempo desde o último atendimento, com opt-out respeitado antes de qualquer follow-up.</p>
        </div>
        <button type="button" className="secondary" onClick={loadRetention}>Atualizar retenção</button>
      </section>

      {error && <div className="status-banner error" role="alert">{error}</div>}

      <section className="crm-retention-kpis" aria-label="Indicadores de retenção">
        {kpis.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </section>

      <section className="panel-card crm-retention-workbench">
        <div className="crm-retention-heading">
          <div>
            <span className="eyebrow">Fila de relacionamento</span>
            <h2>Segmentos acionáveis</h2>
            <p>Cada cliente mostra o motivo da classificação. O sistema não dispara mensagens automaticamente neste marco.</p>
          </div>
          <strong>{visibleClients.length} cliente(s)</strong>
        </div>

        <div className="crm-retention-filters">
          <label>
            <span>Buscar</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefone, e-mail ou motivo..." />
          </label>
          <label>
            <span>Segmento</span>
            <select value={segment} onChange={(event) => setSegment(event.target.value)}>
              {RETENTION_SEGMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="empty-state">Calculando retenção...</p>
        ) : visibleClients.length === 0 ? (
          <p className="empty-state">Nenhum cliente corresponde aos filtros atuais.</p>
        ) : (
          <div className="crm-retention-grid">
            {visibleClients.map((client) => (
              <article className={`crm-retention-card ${retentionPriorityClass(client.primarySegment)}`} key={client.id}>
                <header>
                  <div>
                    <span className="crm-retention-badge">{RETENTION_LABELS[client.primarySegment] || client.primarySegment}</span>
                    <h3>{client.name}</h3>
                    <p>{client.phone} {client.email ? `• ${client.email}` : ''}</p>
                  </div>
                  <span className={`crm-consent ${client.marketingAllowed ? 'allowed' : 'blocked'}`}>
                    {client.marketingAllowed ? 'Comunicação permitida' : 'Opt-out ativo'}
                  </span>
                </header>

                <p className="crm-retention-reason"><strong>Por quê:</strong> {client.reason}</p>
                {client.reasons?.length > 1 && (
                  <ul className="crm-retention-reasons">
                    {client.reasons.slice(1).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}

                <dl className="crm-retention-metrics">
                  <div><dt>Recência</dt><dd>{formatVisitRecency(client)}</dd></div>
                  <div><dt>90 dias</dt><dd>{client.visits90d} visita(s)</dd></div>
                  <div><dt>180 dias</dt><dd>{client.visits180d} visita(s)</dd></div>
                  <div><dt>Aniversário</dt><dd>{client.nextBirthdayInDays === null ? 'Não cadastrado' : `${client.nextBirthdayInDays} dia(s)`}</dd></div>
                </dl>

                <footer>
                  <button type="button" className="secondary" onClick={() => openHistory(client.id)} disabled={historyLoading}>Histórico</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => changeMarketingPermission(client, !client.marketingAllowed)}
                    disabled={busyClientId === client.id}
                  >
                    {client.marketingAllowed ? 'Registrar opt-out' : 'Liberar comunicação'}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => prepareFollowUp(client)}
                    disabled={!client.marketingAllowed || busyClientId === client.id}
                  >
                    Preparar follow-up
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      {prepared?.ok && (
        <section className="panel-card crm-followup-preview" aria-label="Follow-up preparado">
          <div>
            <span className="eyebrow">Contato preparado</span>
            <h2>{prepared.client.name}</h2>
            <p>{prepared.message}</p>
          </div>
          <a
            className="primary button-link"
            href={prepared.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => registerFollowUpInitiated(prepared.client.id)}
          >
            Abrir WhatsApp
          </a>
        </section>
      )}

      {(historyLoading || history) && (
        <section className="panel-card crm-history-panel">
          <div className="crm-retention-heading">
            <div><span className="eyebrow">Histórico de atendimentos</span><h2>{history?.name || 'Carregando...'}</h2></div>
            {history && <button type="button" className="secondary" onClick={() => setHistory(null)}>Fechar</button>}
          </div>
          {historyLoading ? <p>Carregando histórico...</p> : (
            <div className="crm-history-list">
              {(history?.appointments || []).length === 0 ? <p className="empty-state">Nenhum atendimento registrado.</p> : history.appointments.map((appointment) => (
                <article key={appointment.id}>
                  <div><strong>{appointment.service?.name || 'Serviço'}</strong><span>{appointment.professional?.name || 'Profissional não informado'}</span></div>
                  <div><span>{historyDate(appointment.startTime)}</span><strong>{appointment.status}</strong></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <details className="panel-card crm-client-registry">
        <summary>Cadastro e edição de clientes</summary>
        <div className="crm-client-registry-body">
          <ClientsAdmin clients={clients} reload={async () => { await reload(); await loadRetention(); }} />
        </div>
      </details>
    </div>
  );
}
