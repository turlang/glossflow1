import { prisma } from '../lib/prisma';
import { AIResponse, getAIRuntimeConfig, requestAIResponse } from './ai-provider.service';

type AgentSalon = {
  id: string;
  name: string;
  description: string;
  whatsapp: string;
  openingHours: string;
};

type ConversationMessage = {
  direction: 'IN' | 'OUT';
  text: string;
};

type ResponseFunctionCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};

export function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function localOffset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

function parseOpeningHours(text: string) {
  const hourMatches = [...String(text || '').matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*h?\b/gi)]
    .map((match) => Number(match[1]));
  if (hourMatches.length >= 2 && hourMatches[0] < hourMatches[1]) {
    return { startHour: hourMatches[0], endHour: hourMatches[1] };
  }
  return { startHour: 9, endHour: 19 };
}

function asDate(date: string, hour: number, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00${localOffset()}`);
}

function formatLocal(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export async function findSalonByWhatsApp(displayPhoneNumber: string): Promise<AgentSalon | null> {
  const target = normalizePhone(displayPhoneNumber);
  if (!target) return null;

  const salons = await prisma.salon.findMany({
    select: { id: true, name: true, description: true, whatsapp: true, openingHours: true }
  });

  return salons.find((salon) => normalizePhone(salon.whatsapp) === target) || null;
}

export async function isDuplicateWhatsAppMessage(messageId: string) {
  if (!messageId) return false;
  const existing = await prisma.auditLog.findFirst({
    where: { resource: 'WhatsAppMessage', resourceId: messageId },
    select: { id: true }
  });
  return Boolean(existing);
}

export async function saveWhatsAppMessage(input: {
  salonId: string;
  providerMessageId?: string;
  phone: string;
  direction: 'IN' | 'OUT';
  text: string;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.direction === 'IN' ? 'WHATSAPP_RECEIVED' : 'WHATSAPP_SENT',
      resource: 'WhatsAppMessage',
      resourceId: input.providerMessageId || undefined,
      method: input.direction === 'IN' ? 'WEBHOOK' : 'OUTBOUND',
      path: '/webhooks/whatsapp',
      salonId: input.salonId,
      metadata: {
        phone: normalizePhone(input.phone),
        direction: input.direction,
        text: input.text.slice(0, 4000)
      }
    }
  });
}

async function conversationHistory(salonId: string, phone: string): Promise<ConversationMessage[]> {
  const normalized = normalizePhone(phone);
  const logs = await prisma.auditLog.findMany({
    where: { salonId, resource: 'WhatsAppMessage' },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { metadata: true }
  });

  return logs
    .map((log) => log.metadata as Record<string, unknown> | null)
    .filter((metadata): metadata is Record<string, unknown> => Boolean(metadata && normalizePhone(String(metadata.phone || '')) === normalized))
    .map((metadata) => ({
      direction: metadata.direction === 'OUT' ? 'OUT' as const : 'IN' as const,
      text: String(metadata.text || '')
    }))
    .filter((item) => item.text)
    .reverse()
    .slice(-12);
}

export async function hasOpenHumanHandoff(salonId: string, phone: string) {
  const last = await prisma.auditLog.findFirst({
    where: { salonId, resource: 'WhatsAppHandoff', resourceId: normalizePhone(phone) },
    orderBy: { createdAt: 'desc' },
    select: { action: true }
  });
  return last?.action === 'HANDOFF_OPEN';
}

export async function openHumanHandoff(salonId: string, phone: string, reason: string) {
  return prisma.auditLog.create({
    data: {
      action: 'HANDOFF_OPEN',
      resource: 'WhatsAppHandoff',
      resourceId: normalizePhone(phone),
      method: 'AGENT',
      path: '/webhooks/whatsapp',
      salonId,
      metadata: { phone: normalizePhone(phone), reason: reason.slice(0, 500) }
    }
  });
}

export async function closeHumanHandoff(salonId: string, phone: string) {
  return prisma.auditLog.create({
    data: {
      action: 'HANDOFF_CLOSED',
      resource: 'WhatsAppHandoff',
      resourceId: normalizePhone(phone),
      method: 'ADMIN',
      path: '/admin/whatsapp/handoffs',
      salonId,
      metadata: { phone: normalizePhone(phone) }
    }
  });
}

async function listServices(salonId: string) {
  return prisma.service.findMany({
    where: { salonId, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, price: true, durationMin: true }
  });
}

async function listProfessionals(salonId: string) {
  return prisma.professional.findMany({
    where: { salonId, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, specialty: true }
  });
}

async function listClientAppointments(salonId: string, phone: string) {
  return prisma.appointment.findMany({
    where: {
      salonId,
      clientPhone: phone,
      status: 'CONFIRMED',
      startTime: { gte: new Date() }
    },
    include: { service: true, professional: true },
    orderBy: { startTime: 'asc' },
    take: 10
  }).then((items) => items.map((appointment) => ({
    id: appointment.id,
    service: appointment.service.name,
    professional: appointment.professional.name,
    startTime: appointment.startTime.toISOString(),
    displayTime: formatLocal(appointment.startTime)
  })));
}

async function availableSlots(input: {
  salon: AgentSalon;
  serviceId: string;
  professionalId?: string | null;
  date: string;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, message: 'Data inválida. Use YYYY-MM-DD.' };
  }

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, salonId: input.salon.id, active: true }
  });
  if (!service) return { ok: false, message: 'Serviço não encontrado neste salão.' };

  const professionals = input.professionalId
    ? await prisma.professional.findMany({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
    : await prisma.professional.findMany({ where: { salonId: input.salon.id, active: true }, orderBy: { name: 'asc' } });

  if (!professionals.length) return { ok: false, message: 'Nenhum profissional disponível para consulta.' };

  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return { ok: true, slots: [], message: 'Domingo não está habilitado na configuração padrão.' };

  const { startHour, endHour } = parseOpeningHours(input.salon.openingHours);
  const intervalMin = Number(process.env.BOOKING_SLOT_INTERVAL_MINUTES || 30);
  const dayStart = asDate(input.date, 0, 0);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: {
      salonId: input.salon.id,
      status: 'CONFIRMED',
      startTime: { gte: dayStart, lt: nextDay },
      professionalId: { in: professionals.map((professional) => professional.id) }
    },
    select: { professionalId: true, startTime: true, endTime: true }
  });

  const result: Array<{ professionalId: string; professional: string; startTime: string; displayTime: string }> = [];
  for (const professional of professionals) {
    for (let minutes = startHour * 60; minutes + service.durationMin <= endHour * 60; minutes += intervalMin) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const start = asDate(input.date, hour, minute);
      const end = new Date(start.getTime() + service.durationMin * 60_000);
      if (start.getTime() <= Date.now()) continue;

      const conflict = appointments.some((appointment) =>
        appointment.professionalId === professional.id && appointment.startTime < end && appointment.endTime > start
      );
      if (!conflict) {
        result.push({
          professionalId: professional.id,
          professional: professional.name,
          startTime: start.toISOString(),
          displayTime: formatLocal(start)
        });
      }
      if (result.length >= 12) break;
    }
    if (result.length >= 12) break;
  }

  return { ok: true, service: service.name, slots: result };
}

async function createAppointment(input: {
  salon: AgentSalon;
  phone: string;
  serviceId: string;
  professionalId: string;
  startTime: string;
  clientName: string;
  confirmed: boolean;
}) {
  if (!input.confirmed) {
    return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita do cliente antes de criar o agendamento.' };
  }

  const [service, professional] = await Promise.all([
    prisma.service.findFirst({ where: { id: input.serviceId, salonId: input.salon.id, active: true } }),
    prisma.professional.findFirst({ where: { id: input.professionalId, salonId: input.salon.id, active: true } })
  ]);
  if (!service || !professional) return { ok: false, message: 'Serviço ou profissional inválido para este salão.' };

  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false, message: 'Horário inválido ou já passou.' };
  const end = new Date(start.getTime() + service.durationMin * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      salonId: input.salon.id,
      professionalId: professional.id,
      status: 'CONFIRMED',
      startTime: { lt: end },
      endTime: { gt: start }
    }
  });
  if (conflict) return { ok: false, message: 'O horário acabou de ficar indisponível. Consulte novos horários.' };

  const phone = normalizePhone(input.phone);
  const existingClient = await prisma.client.findFirst({ where: { salonId: input.salon.id, phone } });
  const client = existingClient || await prisma.client.create({
    data: { name: input.clientName, phone, notes: 'Criado automaticamente pelo agente de WhatsApp.', salonId: input.salon.id }
  });

  const appointment = await prisma.appointment.create({
    data: {
      clientName: input.clientName,
      clientPhone: phone,
      clientId: client.id,
      startTime: start,
      endTime: end,
      notes: 'Agendado pelo agente de WhatsApp.',
      salonId: input.salon.id,
      serviceId: service.id,
      professionalId: professional.id
    }
  });

  return {
    ok: true,
    appointmentId: appointment.id,
    service: service.name,
    professional: professional.name,
    startTime: start.toISOString(),
    displayTime: formatLocal(start)
  };
}

async function cancelAppointment(salonId: string, phone: string, appointmentId: string, confirmed: boolean) {
  if (!confirmed) return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita antes de cancelar.' };
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, salonId, clientPhone: normalizePhone(phone), status: 'CONFIRMED' }
  });
  if (!appointment) return { ok: false, message: 'Agendamento ativo não encontrado para este cliente.' };
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELED' } });
  return { ok: true, appointmentId, message: 'Agendamento cancelado.' };
}

async function rescheduleAppointment(input: {
  salonId: string;
  phone: string;
  appointmentId: string;
  startTime: string;
  professionalId?: string | null;
  confirmed: boolean;
}) {
  if (!input.confirmed) return { ok: false, requiresConfirmation: true, message: 'Peça confirmação explícita antes de reagendar.' };

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, salonId: input.salonId, clientPhone: normalizePhone(input.phone), status: 'CONFIRMED' },
    include: { service: true }
  });
  if (!appointment) return { ok: false, message: 'Agendamento ativo não encontrado para este cliente.' };

  const professionalId = input.professionalId || appointment.professionalId;
  const professional = await prisma.professional.findFirst({ where: { id: professionalId, salonId: input.salonId, active: true } });
  if (!professional) return { ok: false, message: 'Profissional inválido.' };

  const start = new Date(input.startTime);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) return { ok: false, message: 'Novo horário inválido.' };
  const end = new Date(start.getTime() + appointment.service.durationMin * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      id: { not: appointment.id },
      salonId: input.salonId,
      professionalId,
      status: 'CONFIRMED',
      startTime: { lt: end },
      endTime: { gt: start }
    }
  });
  if (conflict) return { ok: false, message: 'O novo horário não está mais disponível.' };

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { startTime: start, endTime: end, professionalId }
  });
  return { ok: true, appointmentId: appointment.id, professional: professional.name, displayTime: formatLocal(start) };
}

const tools = [
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
];

async function runTool(name: string, args: Record<string, unknown>, salon: AgentSalon, phone: string) {
  switch (name) {
    case 'listar_servicos': return listServices(salon.id);
    case 'listar_profissionais': return listProfessionals(salon.id);
    case 'consultar_horarios': return availableSlots({ salon, serviceId: String(args.service_id || ''), professionalId: args.professional_id ? String(args.professional_id) : null, date: String(args.date || '') });
    case 'listar_agendamentos_cliente': return listClientAppointments(salon.id, normalizePhone(phone));
    case 'criar_agendamento': return createAppointment({ salon, phone, serviceId: String(args.service_id || ''), professionalId: String(args.professional_id || ''), startTime: String(args.start_time || ''), clientName: String(args.client_name || 'Cliente'), confirmed: args.confirmed === true });
    case 'cancelar_agendamento': return cancelAppointment(salon.id, phone, String(args.appointment_id || ''), args.confirmed === true);
    case 'reagendar_agendamento': return rescheduleAppointment({ salonId: salon.id, phone, appointmentId: String(args.appointment_id || ''), startTime: String(args.start_time || ''), professionalId: args.professional_id ? String(args.professional_id) : null, confirmed: args.confirmed === true });
    case 'transferir_para_humano': await openHumanHandoff(salon.id, phone, String(args.reason || 'Solicitação do cliente')); return { ok: true, message: 'Conversa encaminhada para atendimento humano.' };
    default: return { ok: false, message: 'Ferramenta não reconhecida.' };
  }
}

function responseText(response: AIResponse) {
  const parts: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function functionCalls(response: AIResponse): ResponseFunctionCall[] {
  return (response.output || [])
    .filter((item) => item.type === 'function_call' && item.call_id && item.name)
    .map((item) => ({ type: 'function_call', call_id: String(item.call_id), name: String(item.name), arguments: String(item.arguments || '{}') }));
}

function fallbackReply(salon: AgentSalon, text: string, services: Awaited<ReturnType<typeof listServices>>) {
  const normalized = text.toLowerCase();
  if (normalized.includes('humano') || normalized.includes('atendente') || normalized.includes('pessoa')) {
    return `Vou encaminhar sua conversa para a equipe do ${salon.name}.`;
  }
  if (normalized.includes('preço') || normalized.includes('preco') || normalized.includes('valor') || normalized.includes('serviço') || normalized.includes('servico')) {
    if (!services.length) return `Ainda não encontrei serviços cadastrados no ${salon.name}. Posso encaminhar você para a equipe.`;
    return `Estes são alguns serviços do ${salon.name}:\n${services.slice(0, 6).map((service) => `• ${service.name}: R$ ${service.price.toFixed(2).replace('.', ',')}`).join('\n')}\n\nSe quiser agendar, me diga o serviço e o dia que prefere.`;
  }
  return `Olá! Sou o atendimento virtual do ${salon.name}. Posso ajudar com serviços, valores e agendamentos. Qual atendimento você procura?`;
}

export async function answerWhatsAppMessage(input: {
  salon: AgentSalon;
  phone: string;
  clientName?: string;
  text: string;
}) {
  const runtime = getAIRuntimeConfig();
  const history = await conversationHistory(input.salon.id, input.phone);
  const services = await listServices(input.salon.id);

  if (!runtime.configured) {
    if (/\b(humano|atendente|pessoa)\b/i.test(input.text)) {
      await openHumanHandoff(input.salon.id, input.phone, 'Solicitação direta sem IA configurada.');
    }
    return fallbackReply(input.salon, input.text, services);
  }

  // O webhook/testador registra a mensagem recebida antes de chamar a IA.
  // Remove a última cópia quando ela corresponde ao texto atual para não enviar
  // a mesma pergunta duas vezes ao modelo.
  const cleanHistory = [...history];
  const last = cleanHistory[cleanHistory.length - 1];
  if (last?.direction === 'IN' && last.text.trim() === input.text.trim()) cleanHistory.pop();

  const instructions = [
    `Você é o atendente virtual do salão ${input.salon.name}. Responda sempre em português do Brasil, de forma curta, cordial e natural para WhatsApp.`,
    `Informações institucionais: ${input.salon.description || 'não cadastradas'}. Horário informado pelo salão: ${input.salon.openingHours || 'não cadastrado'}.`,
    'Nunca invente preço, serviço, profissional, disponibilidade ou agendamento. Para esses dados, use obrigatoriamente as ferramentas.',
    'Antes de criar, cancelar ou reagendar, apresente um resumo e peça confirmação explícita. Só chame a ferramenta de alteração com confirmed=true depois que o cliente confirmar claramente.',
    'Se houver dúvida, reclamação, situação fora do escopo ou pedido por pessoa, use transferir_para_humano.',
    'Não revele IDs internos ao cliente. Use-os apenas nas chamadas de ferramenta.',
    `Cliente atual: ${input.clientName || 'nome ainda não informado'}; telefone: ${normalizePhone(input.phone)}.`
  ].join('\n');

  const contextItems: Array<Record<string, unknown>> = cleanHistory.map((message) => ({
    role: message.direction === 'IN' ? 'user' : 'assistant',
    content: message.text
  }));
  contextItems.push({ role: 'user', content: input.text });

  let response = await requestAIResponse({
    instructions,
    input: contextItems,
    tools,
    tool_choice: 'auto',
    parallel_tool_calls: false
  });

  for (let round = 0; round < 4; round += 1) {
    const calls = functionCalls(response);
    if (!calls.length) break;

    // A Groq Responses API ainda não suporta previous_response_id. Conforme a
    // documentação oficial, preservamos o estado reenviando o histórico e os
    // itens de output da resposta anterior, seguido dos resultados das tools.
    contextItems.push(...(response.output || []).map((item) => ({ ...item })));

    const outputs: Array<Record<string, unknown>> = [];
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.arguments) as Record<string, unknown>; } catch { args = {}; }
      const result = await runTool(call.name, args, input.salon, input.phone);
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    contextItems.push(...outputs);

    response = await requestAIResponse({
      instructions,
      input: contextItems,
      tools,
      tool_choice: 'auto',
      parallel_tool_calls: false
    });
  }

  return responseText(response) || `Posso ajudar com os serviços e a agenda do ${input.salon.name}. O que você gostaria de fazer?`;
}
