import { prisma } from '../lib/prisma';
import { professionalCanPerform } from './professional-capability.service';

function norm(v: string) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function phone(v: string) {
  return String(v || '').replace(/\D/g, '');
}

function offset() {
  const value = process.env.BUSINESS_TIMEZONE_OFFSET || '-03:00';
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : '-03:00';
}

function affirmative(text: string) {
  return /^(sim|confirmo|pode confirmar|pode agendar|pode marcar|pode ser|esse mesmo|isso|ok|fechado|perfeito)$/i.test(norm(text));
}

function parseSummary(text: string) {
  if (!/resumo do agendamento/i.test(text) || !/confirmar esse hor[aá]rio/i.test(text)) return null;
  const service = text.match(/servi[cç]o:\s*([^\n\r]+)/i)?.[1]?.trim() || '';
  const professional = text.match(/profissional:\s*([^\n\r]+)/i)?.[1]?.trim() || '';
  const dt = text.match(/data e hor[aá]rio:\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:[àa]s)?\s*(\d{2}):(\d{2})/i);
  if (!service || !professional || !dt) return null;
  const [, day, month, year, hour, minute] = dt;
  const start = new Date(`${year}-${month}-${day}T${hour}:${minute}:00${offset()}`);
  return Number.isFinite(start.getTime()) ? { service, professional, start } : null;
}

async function latestPendingSummary(salonId: string, clientPhone: string) {
  const logs = await prisma.auditLog.findMany({
    where: { salonId, resource: 'WhatsAppMessage' },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { metadata: true }
  });

  for (const log of logs) {
    const meta = log.metadata as Record<string, unknown> | null;
    if (!meta || meta.direction !== 'OUT') continue;
    if (phone(String(meta.phone || '')) !== phone(clientPhone)) continue;
    const text = String(meta.text || '').trim();
    if (!text) continue;

    // Se já houve confirmação final depois do resumo, não reutiliza um pedido antigo.
    if (/agendamento (?:j[aá] est[aá] )?confirmado/i.test(text) || /hor[aá]rio j[aá] est[aá] reservado/i.test(text)) return null;

    const summary = parseSummary(text);
    if (summary) return summary;
  }
  return null;
}

function display(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

export async function confirmPendingBooking(input: { salonId: string; salonName: string; clientPhone: string; clientName?: string; text: string }) {
  if (!affirmative(input.text)) return null;
  const summary = await latestPendingSummary(input.salonId, input.clientPhone);
  if (!summary) return null;

  const [services, professionals] = await Promise.all([
    prisma.service.findMany({ where: { salonId: input.salonId, active: true } }),
    prisma.professional.findMany({ where: { salonId: input.salonId, active: true } })
  ]);
  const service = services.find((x) => norm(x.name) === norm(summary.service));
  const professional = professionals.find((x) => norm(x.name) === norm(summary.professional));
  if (!service || !professional) return { handled: true, replyText: 'Não consegui validar esse resumo. Escolha o horário novamente, por favor.' };
  if (!professionalCanPerform(professional, service.id)) {
    return { handled: true, replyText: `${professional.name} não está mais habilitado para executar ${service.name}. Posso consultar outro profissional para você.` };
  }

  const start = summary.start;
  if (start.getTime() <= Date.now()) return { handled: true, replyText: 'Esse horário já passou ou não é mais válido. Posso consultar novos horários para você.' };

  const end = new Date(start.getTime() + service.durationMin * 60000);
  const normalizedPhone = phone(input.clientPhone);

  const existing = await prisma.appointment.findFirst({
    where: { salonId: input.salonId, clientPhone: normalizedPhone, serviceId: service.id, professionalId: professional.id, status: 'CONFIRMED', startTime: start }
  });
  if (existing) return {
    handled: true,
    appointmentId: existing.id,
    replyText: `Seu agendamento já está confirmado ✅\n\n${service.name}\n📅 ${display(start)}\nProfissional: ${professional.name}`
  };

  const conflict = await prisma.appointment.findFirst({
    where: { salonId: input.salonId, professionalId: professional.id, status: 'CONFIRMED', startTime: { lt: end }, endTime: { gt: start } }
  });
  if (conflict) return { handled: true, replyText: 'Esse horário acabou de ficar indisponível. Posso consultar outros horários livres para você.' };

  const client = await prisma.client.findFirst({ where: { salonId: input.salonId, phone: normalizedPhone } })
    || await prisma.client.create({ data: { name: input.clientName || 'Cliente', phone: normalizedPhone, notes: 'Criado pelo atendimento do WhatsApp.', salonId: input.salonId } });

  const appointment = await prisma.appointment.create({
    data: {
      clientName: input.clientName || client.name,
      clientPhone: normalizedPhone,
      clientId: client.id,
      startTime: start,
      endTime: end,
      notes: 'Agendado pelo WhatsApp após confirmação explícita.',
      salonId: input.salonId,
      serviceId: service.id,
      professionalId: professional.id
    }
  });

  return {
    handled: true,
    appointmentId: appointment.id,
    replyText: `Agendamento confirmado ✅\n\n${service.name}\n📅 ${display(start)}\nProfissional: ${professional.name}\n\nSeu horário já está reservado na agenda do ${input.salonName}. Até lá!`
  };
}
