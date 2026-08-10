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
];

function containsAny(value: string, terms: string[]) {
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

/**
 * Quando o cliente pede explicitamente um serviço que o salão não oferece,
 * responde com o catálogo real em vez de abrir handoff ou deixar o modelo
 * improvisar. Retorna null quando todos os serviços reconhecidos existem.
 */
export async function unavailableServiceReply(salonId: string, text: string): Promise<string | null> {
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
    return 'No momento ainda não há serviços ativos cadastrados para atendimento. Assim que o catálogo for configurado, consigo informar valores e horários por aqui.';
  }

  const catalogNames = services.map((service) => normalize(service.name));
  const unavailable = requestedGroups.filter((group) =>
    !catalogNames.some((name) => containsAny(name, group.catalog))
  );

  if (!unavailable.length) return null;

  const unavailableLabel = unavailable.map((group) => group.label).join(', ');
  const availableRequested = requestedGroups.filter((group) => !unavailable.includes(group));
  const availablePrefix = availableRequested.length
    ? `Consigo te atender com ${availableRequested.map((group) => group.label).join(', ')}, mas não encontrei ${unavailableLabel} entre os serviços disponíveis.\n\n`
    : `No momento não encontrei ${unavailableLabel} entre os serviços disponíveis.\n\n`;

  const catalog = services
    .slice(0, 10)
    .map((service) => `• ${service.name} — ${formatMoney(service.price)} · ${service.durationMin} min`)
    .join('\n');

  return `${availablePrefix}Hoje o salão atende:\n${catalog}\n\nSe quiser, me diga qual deles você prefere e eu verifico os horários disponíveis.`;
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
