import { prisma } from '../lib/prisma';

function normalize(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAvailabilityIntent(text: string) {
  const value = normalize(text);
  if (!value) return false;

  // Não sequestra intenções específicas como cancelar, reagendar ou consultar
  // um agendamento já existente do próprio cliente.
  if (/\b(cancel|cancelar|cancele|reagend|remarc|desmarc|meu agendamento|meus agendamentos|marcado|marcada)\b/.test(value)) {
    return false;
  }

  return /\b(vaga|vagas|disponibilidade|disponivel|disponiveis|agenda|horario|horarios)\b/.test(value)
    && /\b(tem|teria|ha|existe|existem|consegue|consigo|quero|queria|preciso|ver|consulta|consultar|agenda|vaga|disponibilidade|horario)\b/.test(value);
}

function hasDateReference(text: string) {
  const value = normalize(text);
  return /\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|segunda-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira|fim de semana|final de semana)\b/.test(value)
    || /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(value)
    || /\b\d{4}-\d{2}-\d{2}\b/.test(value);
}

function currentBusinessDate() {
  const timeZone = process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
  return { year, month, day };
}

function addCalendarDays(date: { year: number; month: number; day: number }, days: number) {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return value.toISOString().slice(0, 10);
}

function resolveDateReference(text: string): string | null {
  const value = normalize(text);
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const today = currentBusinessDate();
  if (/\bdepois de amanha\b/.test(value)) return addCalendarDays(today, 2);
  if (/\bamanha\b/.test(value)) return addCalendarDays(today, 1);
  if (/\bhoje\b/.test(value)) return addCalendarDays(today, 0);

  const shortDate = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (shortDate) {
    const day = Number(shortDate[1]);
    const month = Number(shortDate[2]);
    let year = shortDate[3] ? Number(shortDate[3]) : today.year;
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCDate() === day && date.getUTCMonth() === month - 1) return date.toISOString().slice(0, 10);
  }

  const weekdays: Array<[RegExp, number]> = [
    [/\bdomingo\b/, 0], [/\bsegunda(?:-feira)?\b/, 1], [/\bterca(?:-feira)?\b/, 2],
    [/\bquarta(?:-feira)?\b/, 3], [/\bquinta(?:-feira)?\b/, 4], [/\bsexta(?:-feira)?\b/, 5], [/\bsabado\b/, 6]
  ];
  const current = new Date(Date.UTC(today.year, today.month - 1, today.day, 12));
  for (const [pattern, weekday] of weekdays) {
    if (!pattern.test(value)) continue;
    const delta = (weekday - current.getUTCDay() + 7) % 7 || 7;
    return addCalendarDays(today, delta);
  }

  return null;
}

function serviceMentioned(text: string, serviceNames: string[]) {
  const value = normalize(text);
  if (!value) return false;

  return serviceNames.some((name) => {
    const normalizedName = normalize(name);
    if (!normalizedName) return false;
    if (value.includes(normalizedName)) return true;

    // Permite formas naturais como "corte" para "Corte Feminino", evitando
    // palavras muito curtas/genéricas.
    const meaningfulWords = normalizedName
      .split(' ')
      .filter((word) => word.length >= 4 && !['para', 'com', 'sem', 'global'].includes(word));
    return meaningfulWords.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(value));
  });
}

const SERVICE_GROUPS = [
  { label: 'corte de cabelo', request: ['corte', 'cortar', 'cabelo'], catalog: ['corte'] },
  { label: 'unhas/manicure', request: ['unha', 'unhas', 'manicure', 'pedicure'], catalog: ['unha', 'manicure', 'pedicure'] },
  { label: 'escova', request: ['escova', 'escovar'], catalog: ['escova'] },
  { label: 'coloração', request: ['coloracao', 'colorir', 'pintar'], catalog: ['coloracao', 'color'] },
  { label: 'hidratação', request: ['hidratacao', 'hidratar'], catalog: ['hidratacao'] },
  { label: 'mechas', request: ['mecha', 'mechas', 'luzes'], catalog: ['mecha', 'luzes'] },
  { label: 'progressiva', request: ['progressiva', 'alisamento', 'alisar'], catalog: ['progressiva', 'alisamento'] },
  { label: 'sobrancelhas', request: ['sobrancelha', 'sobrancelhas', 'design de sobrancelha'], catalog: ['sobrancelha'] },
  { label: 'cílios', request: ['cilio', 'cilios', 'extensao de cilios'], catalog: ['cilio'] },
  { label: 'maquiagem', request: ['maquiagem', 'maquiar'], catalog: ['maquiagem'] },
  { label: 'depilação', request: ['depilacao', 'depilar'], catalog: ['depilacao'] },
  { label: 'massagem', request: ['massagem', 'massagear'], catalog: ['massagem'] }
] as const;

type ServiceGroup = typeof SERVICE_GROUPS[number];

function containsAny(value: string, terms: readonly string[]) {
  return terms.some((term) => {
    const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(value);
  });
}

function looksLikeServiceRequest(text: string) {
  const value = normalize(text);
  return /\b(quero|queria|gostaria|preciso|agendar|marcar|fazer|faz|fazem|tem|oferece|oferecem|trabalha|trabalham|cortar|pintar|hidratar|escovar|alisar)\b/.test(value);
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function catalogHasGroup(catalogNames: string[], group: ServiceGroup) {
  return catalogNames.some((name) => containsAny(name, group.catalog));
}

export type UnavailableServiceDecision = {
  reply: string;
  continueWithAI: boolean;
  aiText?: string;
};

/**
 * Analisa pedidos mistos. Se parte do pedido não existir, mostra o catálogo real.
 * Quando outra parte existe e o cliente já informou a data, preserva a intenção
 * de agenda e manda a IA continuar a consulta apenas para o serviço válido.
 */
export async function unavailableServiceDecision(salonId: string, text: string): Promise<UnavailableServiceDecision | null> {
  if (!looksLikeServiceRequest(text)) return null;

  const value = normalize(text);
  const requestedGroups = SERVICE_GROUPS.filter((group) => containsAny(value, group.request));
  if (!requestedGroups.length) return null;

  const services = await prisma.service.findMany({
    where: { salonId, active: true },
    select: { name: true, price: true, durationMin: true },
    orderBy: { name: 'asc' }
  });

  if (!services.length) {
    return {
      continueWithAI: false,
      reply: 'No momento ainda não há serviços ativos cadastrados para atendimento. Assim que o catálogo for configurado, consigo informar valores e horários por aqui.'
    };
  }

  const catalogNames = services.map((service) => normalize(service.name));
  const unavailable = requestedGroups.filter((group) => !catalogHasGroup(catalogNames, group));
  if (!unavailable.length) return null;

  const availableRequested = requestedGroups.filter((group) => catalogHasGroup(catalogNames, group));
  const unavailableLabel = unavailable.map((group) => group.label).join(', ');
  const availableLabel = availableRequested.map((group) => group.label).join(', ');
  const availableServiceNames = availableRequested
    .map((group) => services.find((service) => containsAny(normalize(service.name), group.catalog))?.name)
    .filter((name): name is string => Boolean(name));

  const catalog = services
    .slice(0, 10)
    .map((service) => `• ${service.name} — ${formatMoney(service.price)} · ${service.durationMin} min`)
    .join('\n');

  const date = resolveDateReference(text);
  const canContinue = availableServiceNames.length > 0 && isAvailabilityIntent(text) && Boolean(date);
  const intro = availableRequested.length
    ? `Consigo te atender com ${availableLabel}, mas não encontrei ${unavailableLabel} entre os serviços disponíveis.`
    : `No momento não encontrei ${unavailableLabel} entre os serviços disponíveis.`;

  if (canContinue && date) {
    return {
      continueWithAI: true,
      reply: `${intro}\n\nHoje o salão atende:\n${catalog}`,
      aiText: `Continue o atendimento da mensagem original sem pedir novamente serviço ou data. Consulte a disponibilidade REAL usando as ferramentas para ${availableServiceNames.join(' e ')} na data ${date}. O serviço ${unavailableLabel} já foi informado como indisponível e o catálogo já foi mostrado ao cliente; não repita essas informações. Mensagem original: ${text}`
    };
  }

  return {
    continueWithAI: false,
    reply: `${intro}\n\nHoje o salão atende:\n${catalog}\n\nSe quiser, escolha um desses serviços e me diga o dia que prefere para eu verificar os horários disponíveis.`
  };
}

/** Compatibilidade com chamadas antigas que só precisam da resposta pronta. */
export async function unavailableServiceReply(salonId: string, text: string): Promise<string | null> {
  const decision = await unavailableServiceDecision(salonId, text);
  return decision?.reply || null;
}

/**
 * Intercepta apenas perguntas genéricas sobre disponibilidade.
 * A consulta real da agenda exige serviço + data porque a duração do serviço
 * muda os slots possíveis. Em vez de listar o catálogo sem necessidade, o
 * agente coleta somente a informação que falta e então deixa a IA/tool seguir.
 */
export async function availabilityClarification(salonId: string, text: string): Promise<string | null> {
  if (!isAvailabilityIntent(text)) return null;

  const services = await prisma.service.findMany({
    where: { salonId, active: true },
    select: { name: true },
    orderBy: { name: 'asc' }
  });

  const hasService = serviceMentioned(text, services.map((service) => service.name));
  const hasDate = hasDateReference(text);

  if (hasService && hasDate) return null;

  if (!services.length) {
    return 'Posso verificar a agenda, mas ainda não há serviços ativos cadastrados. Vou precisar que a equipe configure os serviços antes de consultar horários.';
  }

  if (!hasService && !hasDate) {
    return 'Claro! Para eu verificar a agenda certinho, me diga qual serviço você deseja e para qual dia gostaria de consultar.';
  }

  if (!hasService) {
    return 'Claro! Qual serviço você gostaria de agendar? Com isso eu verifico os horários disponíveis para o dia que você informou.';
  }

  return 'Claro! Para qual dia você gostaria de verificar os horários disponíveis?';
}
