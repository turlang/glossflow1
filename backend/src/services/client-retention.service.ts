import { prisma } from '../lib/prisma';
import { normalizePhone } from './whatsapp-agent/contracts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NON_VISIT_STATUSES = new Set(['CANCELLED', 'NO_SHOW']);

export type RetentionSegment = 'BIRTHDAY' | 'INACTIVE_120' | 'INACTIVE_60' | 'FREQUENT' | 'ACTIVE';

type AppointmentLike = {
  id: string;
  startTime: Date | string;
  endTime?: Date | string;
  status: string;
  service?: { id?: string; name?: string } | null;
  professional?: { id?: string; name?: string } | null;
};

type ConsentLike = { granted: boolean; createdAt: Date | string };

type ClientLike = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  birthDate?: Date | string | null;
  createdAt?: Date | string;
  appointments?: AppointmentLike[];
  consents?: ConsentLike[];
};

export type RetentionProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  primarySegment: RetentionSegment;
  tags: RetentionSegment[];
  reason: string;
  reasons: string[];
  marketingAllowed: boolean;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  visits90d: number;
  visits180d: number;
  nextBirthdayInDays: number | null;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDiff(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

function birthdayDistance(birthDate: Date | null, now: Date) {
  if (!birthDate) return null;
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate(), 12));
  const target = thisYear.getTime() < now.getTime() - DAY_MS
    ? new Date(Date.UTC(now.getUTCFullYear() + 1, birthDate.getUTCMonth(), birthDate.getUTCDate(), 12))
    : thisYear;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS));
}

function validPastVisits(appointments: AppointmentLike[], now: Date) {
  return appointments
    .filter((appointment) => {
      const start = toDate(appointment.startTime);
      return Boolean(start && start <= now && !NON_VISIT_STATUSES.has(String(appointment.status || '').toUpperCase()));
    })
    .sort((a, b) => (toDate(b.startTime)?.getTime() || 0) - (toDate(a.startTime)?.getTime() || 0));
}

/**
 * Segmentação determinística e explicável. O cliente pode receber mais de uma
 * tag, mas a prioridade operacional privilegia aniversário e maior inatividade.
 */
export function buildRetentionProfile(client: ClientLike, now = new Date()): RetentionProfile {
  const visits = validPastVisits(client.appointments || [], now);
  const lastVisit = visits.length > 0 ? toDate(visits[0].startTime) : null;
  const daysSinceLastVisit = lastVisit ? dayDiff(lastVisit, now) : null;
  const visits90d = visits.filter((item) => {
    const date = toDate(item.startTime);
    return Boolean(date && now.getTime() - date.getTime() <= 90 * DAY_MS);
  }).length;
  const visits180d = visits.filter((item) => {
    const date = toDate(item.startTime);
    return Boolean(date && now.getTime() - date.getTime() <= 180 * DAY_MS);
  }).length;
  const nextBirthdayInDays = birthdayDistance(toDate(client.birthDate), now);
  const latestConsent = [...(client.consents || [])]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))[0];
  const marketingAllowed = latestConsent?.granted !== false;

  const tags: RetentionSegment[] = [];
  const reasons: string[] = [];
  if (nextBirthdayInDays !== null && nextBirthdayInDays <= 14) {
    tags.push('BIRTHDAY');
    reasons.push(nextBirthdayInDays === 0 ? 'Aniversário hoje.' : `Aniversário em ${nextBirthdayInDays} dia(s).`);
  }
  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 120) {
    tags.push('INACTIVE_120');
    reasons.push(`Sem atendimento há ${daysSinceLastVisit} dias.`);
  } else if (daysSinceLastVisit !== null && daysSinceLastVisit >= 60) {
    tags.push('INACTIVE_60');
    reasons.push(`Sem atendimento há ${daysSinceLastVisit} dias.`);
  }
  if (visits90d >= 3) {
    tags.push('FREQUENT');
    reasons.push(`${visits90d} atendimentos nos últimos 90 dias.`);
  }
  if (tags.length === 0) {
    tags.push('ACTIVE');
    reasons.push(lastVisit ? `Último atendimento há ${daysSinceLastVisit} dia(s).` : 'Cliente ainda sem atendimento concluído registrado.');
  }

  const priority: RetentionSegment[] = ['BIRTHDAY', 'INACTIVE_120', 'INACTIVE_60', 'FREQUENT', 'ACTIVE'];
  const primarySegment = priority.find((segment) => tags.includes(segment)) || 'ACTIVE';

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email || null,
    birthDate: toDate(client.birthDate)?.toISOString() || null,
    primarySegment,
    tags,
    reason: reasons[0],
    reasons,
    marketingAllowed,
    lastVisitAt: lastVisit?.toISOString() || null,
    daysSinceLastVisit,
    visits90d,
    visits180d,
    nextBirthdayInDays
  };
}

function segmentWeight(segment: RetentionSegment) {
  return ({ BIRTHDAY: 5, INACTIVE_120: 4, INACTIVE_60: 3, FREQUENT: 2, ACTIVE: 1 })[segment];
}

export async function getRetentionOverview(salonId: string, now = new Date()) {
  const [clients, followUps] = await Promise.all([
    prisma.client.findMany({
      where: { salonId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        birthDate: true,
        createdAt: true,
        consents: {
          where: { type: 'MARKETING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { granted: true, createdAt: true }
        },
        appointments: {
          where: { startTime: { lte: now } },
          orderBy: { startTime: 'desc' },
          take: 24,
          select: { id: true, startTime: true, endTime: true, status: true }
        }
      }
    }),
    prisma.auditLog.findMany({
      where: {
        salonId,
        resource: 'RetentionFollowUp',
        action: 'RETENTION_FOLLOWUP_INITIATED',
        createdAt: { gte: new Date(now.getTime() - 180 * DAY_MS) }
      },
      orderBy: { createdAt: 'desc' },
      select: { resourceId: true, createdAt: true, metadata: true }
    })
  ]);

  const profiles = clients
    .map((client) => buildRetentionProfile(client, now))
    .sort((a, b) => segmentWeight(b.primarySegment) - segmentWeight(a.primarySegment) || a.name.localeCompare(b.name));

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const initiatedIds = new Set(followUps.map((item) => item.resourceId).filter((id): id is string => Boolean(id)));
  let reactivated = 0;

  for (const clientId of initiatedIds) {
    const client = clientById.get(clientId);
    if (!client) continue;
    const clientFollowUps = followUps.filter((item) => item.resourceId === clientId);
    const returned = clientFollowUps.some((followUp) => {
      const contactDate = toDate(followUp.createdAt);
      if (!contactDate) return false;
      return (client.appointments || []).some((appointment) => {
        const visit = toDate(appointment.startTime);
        return Boolean(
          visit
          && visit > contactDate
          && visit.getTime() - contactDate.getTime() <= 30 * DAY_MS
          && !NON_VISIT_STATUSES.has(String(appointment.status || '').toUpperCase())
        );
      });
    });
    if (returned) reactivated += 1;
  }

  const eligible = profiles.filter((profile) => profile.marketingAllowed);
  const initiated = [...initiatedIds].filter((id) => profileById.has(id)).length;

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalClients: profiles.length,
      eligibleClients: eligible.length,
      optedOut: profiles.length - eligible.length,
      birthdays14d: profiles.filter((profile) => profile.tags.includes('BIRTHDAY')).length,
      inactive60d: profiles.filter((profile) => profile.tags.includes('INACTIVE_60') || profile.tags.includes('INACTIVE_120')).length,
      inactive120d: profiles.filter((profile) => profile.tags.includes('INACTIVE_120')).length,
      frequent90d: profiles.filter((profile) => profile.tags.includes('FREQUENT')).length,
      followUpsInitiated180d: initiated,
      reactivated30d: reactivated,
      reactivationRate: initiated > 0 ? Number(((reactivated / initiated) * 100).toFixed(1)) : 0
    },
    clients: profiles
  };
}

export async function getClientServiceHistory(salonId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, salonId },
    select: {
      id: true,
      name: true,
      phone: true,
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 50,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          notes: true,
          service: { select: { id: true, name: true, price: true } },
          professional: { select: { id: true, name: true } }
        }
      }
    }
  });
}

function templateForSegment(segment: RetentionSegment, firstName: string, salonName: string) {
  if (segment === 'BIRTHDAY') return `Olá, ${firstName}! A equipe ${salonName} lembrou do seu aniversário e gostaria de celebrar esse momento com você. Quando quiser, podemos ajudar a encontrar um horário.`;
  if (segment === 'INACTIVE_120') return `Olá, ${firstName}! Faz um tempo que não vemos você na ${salonName}. Se quiser voltar, podemos ajudar a encontrar um horário que funcione para sua rotina.`;
  if (segment === 'INACTIVE_60') return `Olá, ${firstName}! Sentimos sua falta na ${salonName}. Se estiver pensando no próximo cuidado, podemos ajudar com os horários disponíveis.`;
  if (segment === 'FREQUENT') return `Olá, ${firstName}! Obrigado por fazer parte da rotina da ${salonName}. Quando quiser planejar o próximo atendimento, estamos por aqui.`;
  return `Olá, ${firstName}! Aqui é a equipe ${salonName}. Quando quiser organizar seu próximo atendimento, podemos ajudar com os horários disponíveis.`;
}

function retentionTemplateEvent(segment: RetentionSegment) {
  return ({
    BIRTHDAY: 'RETENTION_BIRTHDAY',
    INACTIVE_120: 'RETENTION_INACTIVE',
    INACTIVE_60: 'RETENTION_INACTIVE',
    FREQUENT: 'RETENTION_FREQUENT',
    ACTIVE: 'RETENTION_FOLLOWUP'
  })[segment];
}

function fillRetentionTemplate(message: string, clientName: string, salonName: string) {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;
  return message
    .replace(/{{\s*(cliente|nome|primeiro_nome)\s*}}/gi, firstName)
    .replace(/{{\s*(salao|salão)\s*}}/gi, salonName)
    .trim();
}

async function retentionClientContext(salonId: string, clientId: string, now: Date) {
  return prisma.client.findFirst({
    where: { id: clientId, salonId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      createdAt: true,
      consents: {
        where: { type: 'MARKETING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { granted: true, createdAt: true }
      },
      appointments: {
        where: { startTime: { lte: now } },
        orderBy: { startTime: 'desc' },
        take: 24,
        select: { id: true, startTime: true, endTime: true, status: true }
      }
    }
  });
}

/**
 * Preparar uma mensagem não conta como contato executado. O Marco 19 só
 * registra a iniciativa quando a equipe efetivamente aciona "Abrir WhatsApp".
 */
export async function prepareRetentionFollowUp(salonId: string, clientId: string, now = new Date()) {
  const [client, salon] = await Promise.all([
    retentionClientContext(salonId, clientId, now),
    prisma.salon.findUnique({ where: { id: salonId }, select: { name: true } })
  ]);

  if (!client) return { ok: false as const, code: 'CLIENT_NOT_FOUND' as const };
  const profile = buildRetentionProfile(client, now);
  if (!profile.marketingAllowed) return { ok: false as const, code: 'MARKETING_OPT_OUT' as const, profile };

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { salonId, active: true, event: retentionTemplateEvent(profile.primarySegment) },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, message: true, event: true }
  });
  const salonName = salon?.name || 'nosso salão';
  const firstName = client.name.trim().split(/\s+/)[0] || client.name;
  const message = template?.message
    ? fillRetentionTemplate(template.message, client.name, salonName)
    : templateForSegment(profile.primarySegment, firstName, salonName);
  const phone = normalizePhone(client.phone);
  if (!phone) return { ok: false as const, code: 'INVALID_PHONE' as const, profile };

  return {
    ok: true as const,
    profile,
    message,
    templateId: template?.id || null,
    templateEvent: template?.event || retentionTemplateEvent(profile.primarySegment),
    whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  };
}

export async function recordRetentionFollowUpInitiated(salonId: string, clientId: string, now = new Date()) {
  const client = await retentionClientContext(salonId, clientId, now);
  if (!client) return { ok: false as const, code: 'CLIENT_NOT_FOUND' as const };
  const profile = buildRetentionProfile(client, now);
  if (!profile.marketingAllowed) return { ok: false as const, code: 'MARKETING_OPT_OUT' as const, profile };
  const phone = normalizePhone(client.phone);
  if (!phone) return { ok: false as const, code: 'INVALID_PHONE' as const, profile };

  await prisma.auditLog.create({
    data: {
      action: 'RETENTION_FOLLOWUP_INITIATED',
      resource: 'RetentionFollowUp',
      resourceId: client.id,
      method: 'ADMIN',
      path: `/admin/clients/${client.id}/follow-up/contacted`,
      salonId,
      metadata: {
        phone,
        segment: profile.primarySegment,
        reason: profile.reason
      }
    }
  });

  return { ok: true as const, profile };
}
