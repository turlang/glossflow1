import { prisma } from '../lib/prisma';
import { publicBookingAvailability } from './public-booking-availability.service';
import { normalizePhone, saveWhatsAppMessage } from './whatsapp-agent.service';
import { sendWhatsAppMessage } from './whatsapp.service';

const OFFER_MINUTES = Number(process.env.WAITLIST_OFFER_MINUTES || 20);

function businessTimeZone() {
  return process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';
}

function businessDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone(),
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(`${date}T12:00:00Z`));
}

function localTime(iso: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: businessTimeZone(), hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso));
}

function inTimeWindow(time: string, earliest: string, latest: string) {
  return time >= (earliest || '00:00') && time <= (latest || '23:59');
}

function offerKey(professionalId: string, startTime: string) {
  return `${professionalId}|${new Date(startTime).toISOString()}`;
}

function affirmative(text: string) {
  const value = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(sim|quero|aceito|confirmo|pode reservar|pode marcar|pode agendar|pode ser|fechado|esse mesmo|isso)$/i.test(value);
}

function negative(text: string) {
  const value = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^(nao|agora nao|nao quero|recuso|passo|deixa pra la)$/i.test(value);
}

export async function expireWaitlistOffers(salonId?: string) {
  return prisma.waitlistEntry.updateMany({
    where: {
      ...(salonId ? { salonId } : {}),
      status: 'OFFERED',
      offeredUntil: { lt: new Date() }
    },
    data: {
      status: 'WAITING',
      offeredStartTime: null,
      offeredUntil: null,
      offeredProfessionalId: null
    }
  });
}

export async function matchWaitlistForDate(input: { salonId: string; date: string }) {
  await expireWaitlistOffers(input.salonId);

  const salon = await prisma.salon.findUnique({
    where: { id: input.salonId },
    select: { id: true, name: true, openingHours: true }
  });
  if (!salon) return null;

  const entries = await prisma.waitlistEntry.findMany({
    where: { salonId: input.salonId, desiredDate: input.date, status: 'WAITING' },
    include: { service: true, professional: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 80
  });
  if (!entries.length) return null;

  const activeOffers = await prisma.waitlistEntry.findMany({
    where: {
      salonId: input.salonId,
      desiredDate: input.date,
      status: 'OFFERED',
      offeredUntil: { gt: new Date() },
      offeredStartTime: { not: null },
      offeredProfessionalId: { not: null }
    },
    select: { offeredStartTime: true, offeredProfessionalId: true }
  });
  const reservedOfferKeys = new Set(activeOffers.map((entry) => offerKey(entry.offeredProfessionalId || '', entry.offeredStartTime?.toISOString() || '')));

  const availabilityCache = new Map<string, Awaited<ReturnType<typeof publicBookingAvailability>>>();
  const candidates: Array<{
    entry: typeof entries[number];
    slot: any;
    score: number;
  }> = [];

  for (const entry of entries) {
    const cacheKey = `${entry.serviceId}:${entry.professionalId || '*'}`;
    let availability = availabilityCache.get(cacheKey);
    if (availability === undefined) {
      availability = await publicBookingAvailability({
        salon,
        serviceId: entry.serviceId,
        professionalId: entry.professionalId || undefined,
        date: input.date
      });
      availabilityCache.set(cacheKey, availability);
    }
    if (!availability || availability.mode !== 'day') continue;

    const slots = availability.smartFit?.recommendedSlots || availability.professionals.flatMap((professional) =>
      professional.slots.map((slot) => ({ ...slot, professionalId: professional.id, professionalName: professional.name }))
    );

    for (const slot of slots) {
      const time = localTime(slot.startTime);
      const key = offerKey(slot.professionalId, slot.startTime);
      if (!inTimeWindow(time, entry.earliestTime, entry.latestTime)) continue;
      if (reservedOfferKeys.has(key) || entry.declinedOfferKeys.includes(key)) continue;

      const waitingHours = Math.max(0, (Date.now() - entry.createdAt.getTime()) / 3_600_000);
      const ageBonus = Math.min(18, Math.floor(waitingHours / 12));
      const preferenceBonus = entry.professionalId && entry.professionalId === slot.professionalId ? 8 : 0;
      const score = Number(slot.fitScore || 50) + entry.priority * 5 + ageBonus + preferenceBonus;
      candidates.push({ entry, slot, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.entry.createdAt.getTime() - b.entry.createdAt.getTime());
  const best = candidates[0];
  if (!best) return null;

  const offeredUntil = new Date(Date.now() + Math.max(5, OFFER_MINUTES) * 60_000);
  const message = `Surgiu uma vaga para ${best.entry.service.name} em ${dateLabel(input.date)} às ${localTime(best.slot.startTime)} com ${best.slot.professionalName}.\n\nPosso reservar esse horário para você? Responda QUERO para confirmar. A oferta fica disponível por ${Math.max(5, OFFER_MINUTES)} minutos.`;
  const result = await sendWhatsAppMessage({ phone: best.entry.clientPhone, message });
  if (!result.ok) return { matched: true, offered: false, entryId: best.entry.id, reason: 'WHATSAPP_SEND_FAILED', result };

  const providerData = result as { data?: { messages?: Array<{ id?: string }> } };
  await Promise.all([
    prisma.waitlistEntry.update({
      where: { id: best.entry.id },
      data: {
        status: 'OFFERED',
        offeredStartTime: new Date(best.slot.startTime),
        offeredUntil,
        offeredProfessionalId: best.slot.professionalId
      }
    }),
    saveWhatsAppMessage({
      salonId: input.salonId,
      providerMessageId: providerData.data?.messages?.[0]?.id,
      phone: best.entry.clientPhone,
      direction: 'OUT',
      text: message
    })
  ]);

  return {
    matched: true,
    offered: true,
    entryId: best.entry.id,
    startTime: best.slot.startTime,
    professionalId: best.slot.professionalId,
    professionalName: best.slot.professionalName,
    score: best.score,
    offeredUntil
  };
}

export async function matchWaitlistAfterAppointmentChange(input: { salonId: string; previousStartTime: Date }) {
  return matchWaitlistForDate({ salonId: input.salonId, date: businessDate(input.previousStartTime) });
}

export async function handleWaitlistWhatsAppReply(input: {
  salonId: string;
  salonName: string;
  clientPhone: string;
  clientName?: string;
  text: string;
}) {
  await expireWaitlistOffers(input.salonId);
  const phone = normalizePhone(input.clientPhone);
  if (!phone) return { handled: false as const };

  const entries = await prisma.waitlistEntry.findMany({
    where: { salonId: input.salonId, status: 'OFFERED', offeredUntil: { gt: new Date() } },
    include: { service: true },
    orderBy: { updatedAt: 'desc' },
    take: 30
  });
  const entry = entries.find((item) => normalizePhone(item.clientPhone) === phone);
  if (!entry || !entry.offeredStartTime || !entry.offeredProfessionalId) return { handled: false as const };

  const key = offerKey(entry.offeredProfessionalId, entry.offeredStartTime.toISOString());
  if (negative(input.text)) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: 'WAITING',
        declinedOfferKeys: { push: key },
        offeredStartTime: null,
        offeredUntil: null,
        offeredProfessionalId: null
      }
    });
    return {
      handled: true as const,
      replyText: 'Tudo bem. Mantive você na lista de espera e não vou oferecer novamente esse mesmo horário. Se surgir outra opção compatível, eu aviso por aqui.'
    };
  }

  if (!affirmative(input.text)) return { handled: false as const };

  const salon = await prisma.salon.findUnique({
    where: { id: input.salonId },
    select: { id: true, openingHours: true }
  });
  if (!salon) return { handled: true as const, replyText: 'Não consegui validar a agenda agora. A equipe pode conferir esse horário para você.' };

  const availability = await publicBookingAvailability({
    salon,
    serviceId: entry.serviceId,
    professionalId: entry.offeredProfessionalId,
    date: entry.desiredDate
  });
  const slotExists = availability?.mode === 'day' && availability.professionals.some((professional) =>
    professional.id === entry.offeredProfessionalId
      && professional.slots.some((slot) => new Date(slot.startTime).getTime() === entry.offeredStartTime!.getTime())
  );

  if (!slotExists) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'WAITING', offeredStartTime: null, offeredUntil: null, offeredProfessionalId: null }
    });
    return {
      handled: true as const,
      replyText: 'Esse horário acabou de ficar indisponível. Mantive você na lista de espera e vou procurar a próxima opção compatível.'
    };
  }

  const professional = await prisma.professional.findFirst({
    where: { id: entry.offeredProfessionalId, salonId: input.salonId, active: true },
    select: { id: true, name: true }
  });
  if (!professional) return { handled: true as const, replyText: 'O profissional desse encaixe não está mais disponível. Mantive você na lista de espera.' };

  const existingClient = await prisma.client.findFirst({ where: { salonId: input.salonId, phone } });
  const client = existingClient || await prisma.client.create({
    data: {
      name: entry.clientName || input.clientName || 'Cliente',
      phone,
      email: entry.clientEmail || null,
      notes: 'Criado automaticamente pela lista de espera.',
      salonId: input.salonId
    }
  });

  const endTime = new Date(entry.offeredStartTime.getTime() + entry.service.durationMin * 60_000);
  const appointment = await prisma.appointment.create({
    data: {
      clientName: entry.clientName || input.clientName || 'Cliente',
      clientPhone: phone,
      clientEmail: entry.clientEmail || null,
      clientId: client.id,
      startTime: entry.offeredStartTime,
      endTime,
      notes: 'Agendamento confirmado a partir da lista de espera inteligente.',
      salonId: input.salonId,
      serviceId: entry.serviceId,
      professionalId: professional.id
    }
  });

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: 'BOOKED', offeredUntil: null }
  });

  return {
    handled: true as const,
    appointmentId: appointment.id,
    replyText: `Agendamento confirmado ✅\n\n${entry.service.name}\n📅 ${dateLabel(entry.desiredDate)} às ${localTime(entry.offeredStartTime)}\nProfissional: ${professional.name}\n\nSeu horário já está reservado na agenda do ${input.salonName}.`
  };
}
