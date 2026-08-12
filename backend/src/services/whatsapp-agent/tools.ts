import { openHumanHandoff } from './conversation.repository';
import {
  availableSlots,
  cancelAppointment,
  createAppointment,
  listClientAppointments,
  listProfessionals,
  listServices,
  previewCancelAppointment,
  previewCreateAppointment,
  previewRescheduleAppointment,
  rescheduleAppointment
} from './appointment-tools.service';
import { createPendingAction, PendingWhatsAppAction } from './action-confirmation.service';
import { AgentSalon, normalizePhone, ToolArgs } from './contracts';

/** Contratos de function calling expostos ao provider de IA. */
export const tools = [
  {
    type: 'function', name: 'listar_servicos', description: 'Lista somente serviços reais e preços cadastrados no salão.', strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function', name: 'listar_profissionais', description: 'Lista profissionais ativos do salão.', strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function', name: 'consultar_horarios', description: 'Consulta horários realmente livres na agenda. Nunca invente disponibilidade sem usar esta função.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        service_id: { type: 'string' },
        professional_id: { type: ['string', 'null'] },
        date: { type: 'string', description: 'Data no formato YYYY-MM-DD.' }
      },
      required: ['service_id', 'professional_id', 'date']
    }
  },
  {
    type: 'function', name: 'listar_agendamentos_cliente', description: 'Lista próximos agendamentos confirmados do cliente atual.', strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function', name: 'criar_agendamento', description: 'Prepara uma proposta de agendamento. Esta função nunca cria o agendamento imediatamente; o servidor exigirá confirmação explícita em uma mensagem posterior.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        service_id: { type: 'string' }, professional_id: { type: 'string' }, start_time: { type: 'string' }, client_name: { type: 'string' }
      },
      required: ['service_id', 'professional_id', 'start_time', 'client_name']
    }
  },
  {
    type: 'function', name: 'cancelar_agendamento', description: 'Prepara uma proposta de cancelamento do próprio cliente. O servidor só executa após confirmação explícita em mensagem posterior.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { appointment_id: { type: 'string' } },
      required: ['appointment_id']
    }
  },
  {
    type: 'function', name: 'reagendar_agendamento', description: 'Prepara uma proposta de reagendamento do próprio cliente depois de validar o novo horário. O servidor só executa após confirmação explícita em mensagem posterior.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        appointment_id: { type: 'string' }, start_time: { type: 'string' }, professional_id: { type: ['string', 'null'] }
      },
      required: ['appointment_id', 'start_time', 'professional_id']
    }
  },
  {
    type: 'function', name: 'transferir_para_humano', description: 'Pausa a automação e encaminha a conversa para atendimento humano.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { reason: { type: 'string' } },
      required: ['reason']
    }
  }
] as const;

async function proposeCreate(args: ToolArgs, salon: AgentSalon, phone: string) {
  const payload = {
    service_id: String(args.service_id || ''),
    professional_id: String(args.professional_id || ''),
    start_time: String(args.start_time || ''),
    client_name: String(args.client_name || 'Cliente')
  };
  const preview = await previewCreateAppointment({
    salon,
    phone,
    serviceId: payload.service_id,
    professionalId: payload.professional_id,
    startTime: payload.start_time,
    clientName: payload.client_name
  });
  if (!preview.ok) return preview;
  const pending = await createPendingAction({ salonId: salon.id, phone, type: 'CREATE_APPOINTMENT', payload, summary: preview.message });
  return { ok: false, requiresConfirmation: true, pendingActionId: pending.id, summary: preview.message, message: `${preview.message}\n\nResponda apenas CONFIRMAR para executar ou CANCELAR AÇÃO para desistir.` };
}

async function proposeCancel(args: ToolArgs, salon: AgentSalon, phone: string) {
  const payload = { appointment_id: String(args.appointment_id || '') };
  const preview = await previewCancelAppointment(salon.id, phone, payload.appointment_id);
  if (!preview.ok) return preview;
  const pending = await createPendingAction({ salonId: salon.id, phone, type: 'CANCEL_APPOINTMENT', payload, summary: preview.message });
  return { ok: false, requiresConfirmation: true, pendingActionId: pending.id, summary: preview.message, message: `${preview.message}\n\nResponda apenas CONFIRMAR para executar ou CANCELAR AÇÃO para desistir.` };
}

async function proposeReschedule(args: ToolArgs, salon: AgentSalon, phone: string) {
  const payload = {
    appointment_id: String(args.appointment_id || ''),
    start_time: String(args.start_time || ''),
    professional_id: args.professional_id ? String(args.professional_id) : null
  };
  const preview = await previewRescheduleAppointment({
    salonId: salon.id,
    phone,
    appointmentId: payload.appointment_id,
    startTime: payload.start_time,
    professionalId: payload.professional_id
  });
  if (!preview.ok) return preview;
  const pending = await createPendingAction({ salonId: salon.id, phone, type: 'RESCHEDULE_APPOINTMENT', payload, summary: preview.message });
  return { ok: false, requiresConfirmation: true, pendingActionId: pending.id, summary: preview.message, message: `${preview.message}\n\nResponda apenas CONFIRMAR para executar ou CANCELAR AÇÃO para desistir.` };
}

/** Despacho exposto ao modelo: mutações apenas criam proposta pendente. */
export async function runTool(name: string, args: ToolArgs, salon: AgentSalon, phone: string) {
  switch (name) {
    case 'listar_servicos':
      return listServices(salon.id);
    case 'listar_profissionais':
      return listProfessionals(salon.id);
    case 'consultar_horarios':
      return availableSlots({
        salon,
        serviceId: String(args.service_id || ''),
        professionalId: args.professional_id ? String(args.professional_id) : null,
        date: String(args.date || '')
      });
    case 'listar_agendamentos_cliente':
      return listClientAppointments(salon.id, normalizePhone(phone));
    case 'criar_agendamento':
      return proposeCreate(args, salon, phone);
    case 'cancelar_agendamento':
      return proposeCancel(args, salon, phone);
    case 'reagendar_agendamento':
      return proposeReschedule(args, salon, phone);
    case 'transferir_para_humano':
      await openHumanHandoff(salon.id, phone, String(args.reason || 'Solicitação do cliente'));
      return { ok: true, message: 'Conversa encaminhada para atendimento humano.' };
    default:
      return { ok: false, message: 'Ferramenta não reconhecida.' };
  }
}

/**
 * Único dispatcher capaz de persistir mutações. Ele recebe uma proposta que o
 * servidor recuperou do histórico e validou contra uma mensagem de confirmação.
 */
export async function runConfirmedAction(action: PendingWhatsAppAction, salon: AgentSalon, phone: string) {
  const args = action.payload;
  switch (action.type) {
    case 'CREATE_APPOINTMENT':
      return createAppointment({
        salon,
        phone,
        serviceId: String(args.service_id || ''),
        professionalId: String(args.professional_id || ''),
        startTime: String(args.start_time || ''),
        clientName: String(args.client_name || 'Cliente'),
        confirmed: true
      });
    case 'CANCEL_APPOINTMENT':
      return cancelAppointment(salon.id, phone, String(args.appointment_id || ''), true);
    case 'RESCHEDULE_APPOINTMENT':
      return rescheduleAppointment({
        salonId: salon.id,
        phone,
        appointmentId: String(args.appointment_id || ''),
        startTime: String(args.start_time || ''),
        professionalId: args.professional_id ? String(args.professional_id) : null,
        confirmed: true
      });
  }
}
