import React from 'react';
import { ROLES } from '../../utils/auth.js';
import { AgendaEnterprise } from './AgendaEnterprise.jsx';
import { AgendaCheckoutPanel } from './agenda/AgendaCheckoutPanel.jsx';

const MANAGER_ROLES = new Set([ROLES.ADMIN, ROLES.RECEPTION]);

/**
 * Porta de entrada única do domínio Agenda.
 *
 * ADMIN/RECEPTION recebem os atalhos operacionais necessários para tocar o dia
 * sem navegar por módulos desconectados. PROFESSIONAL permanece em modo de
 * leitura, preservando o contrato de RBAC homologado no Marco 16.
 */
export function AgendaCommercialHub({ role, appointments, professionals, services, reload, setPage }) {
  const canManage = MANAGER_ROLES.has(role);

  return (
    <div className="agenda-commercial-hub">
      <section className="agenda-command-center panel-card" aria-label="Central comercial da Agenda">
        <div className="agenda-command-copy">
          <span className="eyebrow">Agenda comercial</span>
          <h2>{canManage ? 'Operação do dia, encaixes e fila em um único fluxo' : 'Sua agenda de trabalho'}</h2>
          <p>
            {canManage
              ? 'Use a visão Enterprise para planejar e filtrar. Entre na operação diária para criar, mover e acompanhar atendimentos; Smart Fit e Lista de Espera cuidam dos espaços que surgirem.'
              : 'Consulte seus horários e compromissos. Alterações de agenda continuam restritas à administração e à recepção.'}
          </p>
        </div>

        {canManage && (
          <div className="agenda-command-actions" aria-label="Ações comerciais da Agenda">
            <button type="button" className="primary" onClick={() => setPage('operational-agenda')}>
              <strong>Operação do dia</strong>
              <span>Criar, mover, confirmar chegada e atendimento</span>
            </button>
            <button type="button" className="secondary" onClick={() => setPage('smart-fit')}>
              <strong>Encaixe inteligente</strong>
              <span>Encontrar o melhor bloco livre</span>
            </button>
            <button type="button" className="secondary" onClick={() => setPage('waitlist')}>
              <strong>Lista de espera</strong>
              <span>Converter cancelamentos em novos horários</span>
            </button>
            <button type="button" className="secondary" onClick={() => setPage('professional-schedule')}>
              <strong>Jornada da equipe</strong>
              <span>Pausas, bloqueios, férias e expediente</span>
            </button>
          </div>
        )}

        {canManage && (
          <div className="agenda-flow-strip full-span" aria-label="Fluxo comercial da Agenda">
            <span><b>1</b> Cliente solicita</span>
            <span><b>2</b> Agenda valida capacidade</span>
            <span><b>3</b> Salão opera o atendimento</span>
            <span><b>4</b> Checkout conclui PDV e financeiro</span>
          </div>
        )}
      </section>

      <AgendaEnterprise
        appointments={appointments}
        professionals={professionals}
        services={services}
        reload={reload}
        readOnly={!canManage}
      />

      {canManage && <AgendaCheckoutPanel appointments={appointments} reload={reload} />}
    </div>
  );
}
