import { openHumanHandoff } from './conversation.repository';
import {
  availableSlots,
  cancelAppointment,
  createAppointment,
  listClientAppointments,
  listProfessionals,
  listServices,
  rescheduleAppointment
} from './appointment-tools.service';
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
    type: 'function', name: 'criar_agendamento', description: 'Cria agendamento somente após confirmação explícita do cliente e usando horário consultado.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        service_id: { type: 'string' }, professional_id: { type: 'string' }, start_time: { type: 'string' }, client_name: { type: 'string' }, confirmed: { type: 'boolean' }
      },
      required: ['service_id', 'professional_id', 'start_time', 'client_name', 'confirmed']
    }
  },
  {
    type: 'function', name: 'cancelar_agendamento', description: 'Cancela um agendamento do próprio cliente, apenas após confirmação explícita.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { appointment_id: { type: 'string' }, confirmed: { type: 'boolean' } },
      required: ['appointment_id', 'confirmed']
    }
  },
  {
    type: 'function', name: 'reagendar_agendamento', description: 'Reagenda o próprio atendimento após confirmação explícita e validação de conflito.', strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        appointment_id: { type: 'string' }, start_time: { type: 'string' }, professional_id: { type: ['string', 'null'] }, confirmed: { type: 'boolean' }
      },
      required: ['appointment_id', 'start_time', 'professional_id', 'confirmed']
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

/** Despacho isolado facilita testes de cada mutação sem chamar o provider de IA. */
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
      return createAppointment({
        salon,
        phone,
        serviceId: String(args.service_id || ''),
        professionalId: String(args.professional_id || ''),
        startTime: String(args.start_time || ''),
        clientName: String(args.client_name || 'Cliente'),
        confirmed: args.confirmed === true
      });
    case 'cancelar_agendamento':
      return cancelAppointment(salon.id, phone, String(args.appointment_id || ''), args.confirmed === true);
    case 'reagendar_agendamento':
      return rescheduleAppointment({
        salonId: salon.id,
        phone,
        appointmentId: String(args.appointment_id || ''),
        startTime: String(args.start_time || ''),
        professionalId: args.professional_id ? String(args.professional_id) : null,
        confirmed: args.confirmed === true
      });
    case 'transferir_para_humano':
      await openHumanHandoff(salon.id, phone, String(args.reason || 'Solicitação do cliente'));
      return { ok: true, message: 'Conversa encaminhada para atendimento humano.' };
    default:
      return { ok: false, message: 'Ferramenta não reconhecida.' };
  }
}
