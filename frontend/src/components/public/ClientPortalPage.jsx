import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';
import { SkeletonPage, StateMessage } from '../ui/Feedback.jsx';

function pointsBalance(entries = []) {
  return entries.reduce((sum, entry) => sum + (entry.type === 'REDEEM' ? -Number(entry.points || 0) : Number(entry.points || 0)), 0);
}

/** Portal público autenticado por link temporário gerado pelo salão. */
export function ClientPortalPage({ token, setPage }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    request(`/client-portal/${encodeURIComponent(token)}/overview`)
      .then((response) => active && setData(response))
      .catch((portalError) => active && setError(portalError.message));
    return () => { active = false; };
  }, [token]);

  const upcoming = useMemo(
    () => (data?.appointments || []).filter((item) => new Date(item.startTime) >= new Date() && !['CANCELED', 'NO_SHOW'].includes(item.status)),
    [data]
  );

  if (!token) return <StateMessage title="Link do portal inválido" text="Solicite um novo acesso ao salão." danger />;
  if (error) return <StateMessage title="Portal indisponível" text={error} danger />;
  if (!data) return <SkeletonPage />;

  return (
    <main className="public-section">
      <section className="hero-card">
        <span className="eyebrow">Portal do cliente</span>
        <h1>Olá, {data.client?.name}</h1>
        <p>{data.salon?.name || 'GlossFlow'} reuniu aqui seus próximos horários, benefícios e histórico.</p>
        <button className="secondary" type="button" onClick={() => setPage('public')}>Voltar à vitrine</button>
      </section>

      <section className="admin-pro-stats" aria-label="Resumo do cliente">
        <article className="pro-stat-card"><div><strong>{upcoming.length}</strong><span>Próximos horários</span></div></article>
        <article className="pro-stat-card"><div><strong>{data.packages?.filter((item) => item.status === 'ACTIVE').length || 0}</strong><span>Pacotes ativos</span></div></article>
        <article className="pro-stat-card"><div><strong>{data.memberships?.filter((item) => item.status === 'ACTIVE').length || 0}</strong><span>Assinaturas</span></div></article>
        <article className="pro-stat-card"><div><strong>{pointsBalance(data.loyaltyEntries)}</strong><span>Pontos</span></div></article>
      </section>

      <section className="inventory-layout">
        <section className="panel-card">
          <h2>Agenda</h2>
          {(data.appointments || []).slice(0, 12).map((item) => (
            <div className="editable-row" key={item.id}>
              <span>{new Date(item.startTime).toLocaleString('pt-BR')} • {item.service?.name || 'Serviço'} • {item.professional?.name || 'Profissional'} • {item.status}</span>
            </div>
          ))}
        </section>

        <section className="panel-card">
          <h2>Benefícios</h2>
          {(data.packages || []).map((item) => <p key={item.id}>Pacote • {item.remainingCredits} crédito(s) • {item.status}</p>)}
          {(data.memberships || []).map((item) => <p key={item.id}>Assinatura • {item.status} • próxima cobrança {item.nextBillingAt ? new Date(item.nextBillingAt).toLocaleDateString('pt-BR') : 'não definida'}</p>)}
          {(data.giftCards || []).map((item) => <p key={item.id}>Gift card {item.code} • saldo {currency(item.balance)} • {item.status}</p>)}
        </section>
      </section>
    </main>
  );
}
