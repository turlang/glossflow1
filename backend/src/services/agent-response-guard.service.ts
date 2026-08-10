import { closeHumanHandoff, hasOpenHumanHandoff } from './whatsapp-agent.service';

function normalize(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function customerAllowsHandoff(text: string) {
  const value = normalize(text);
  return /\b(humano|atendente|pessoa|alguem|falar com|chamar alguem|reclamacao|reclamar|insatisfeit|cobranca|estorno|reembolso)\b/.test(value);
}

function looksInternal(line: string) {
  const value = line.trim();
  if (!value) return false;
  return /^(user wants|need to|now need|possibly|already done|according to)/i.test(value)
    || /developer instructions|system instructions|internal reasoning|chain of thought|tool call|function call|transferir_para_humano/i.test(value)
    || (/\buser\b/i.test(value) && /\bdeveloper\b/i.test(value));
}

export function sanitizeAgentReply(raw: string) {
  const filtered = String(raw || '')
    .split(/\r?\n/)
    .filter((line) => !looksInternal(line))
    .join('\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return filtered;
}

function stripUnwantedHandoffLanguage(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/encaminh|transferir|atendente humano|atendimento humano|aguarde um instante/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function guardAgentReply(input: {
  salonId: string;
  phone: string;
  userText: string;
  replyText: string;
}) {
  let replyText = sanitizeAgentReply(input.replyText);
  const handoffOpen = await hasOpenHumanHandoff(input.salonId, input.phone);
  const handoffAllowed = customerAllowsHandoff(input.userText);

  if (handoffOpen && !handoffAllowed) {
    await closeHumanHandoff(input.salonId, input.phone);
    replyText = stripUnwantedHandoffLanguage(replyText);

    if (!replyText || replyText.length < 12) {
      replyText = 'Consigo continuar te ajudando por aqui. Se algum serviço que você pediu não estiver disponível, eu te aviso e seguimos com os serviços que o salão oferece.';
    }
  }

  if (!replyText) {
    replyText = 'Posso continuar te ajudando com serviços, valores e horários disponíveis. O que você gostaria de fazer?';
  }

  return {
    replyText,
    handoffOpen: handoffOpen && handoffAllowed,
    handoffBlocked: handoffOpen && !handoffAllowed
  };
}
