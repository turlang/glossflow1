import { AIResponse, getAIRuntimeConfig, requestAIResponse } from '../ai-provider.service';
import {
  confirmationDecision,
  pendingActionForPhone,
  pendingActionPrompt,
  recordPendingActionState
} from './action-confirmation.service';
import { conversationHistory, openHumanHandoff } from './conversation.repository';
import { AgentSalon, normalizePhone, ResponseFunctionCall, ToolArgs } from './contracts';
import { listServices } from './appointment-tools.service';
import { buildSalonKnowledgeBase } from './knowledge-base.service';
import { runConfirmedAction, runTool, tools } from './tools';

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
    .map((item) => ({
      type: 'function_call',
      call_id: String(item.call_id),
      name: String(item.name),
      arguments: String(item.arguments || '{}')
    }));
}

function asksForHuman(text: string) {
  return /\b(humano|atendente|pessoa)\b/i.test(text);
}

function fallbackReply(salon: AgentSalon, text: string, services: Awaited<ReturnType<typeof listServices>>) {
  const normalized = text.toLowerCase();
  if (asksForHuman(text)) return `Vou encaminhar sua conversa para a equipe do ${salon.name}.`;
  if (normalized.includes('preço') || normalized.includes('preco') || normalized.includes('valor') || normalized.includes('serviço') || normalized.includes('servico')) {
    if (!services.length) return `Ainda não encontrei serviços cadastrados no ${salon.name}. Posso encaminhar você para a equipe.`;
    return `Estes são alguns serviços do ${salon.name}:\n${services.slice(0, 6).map((service) => `• ${service.name}: R$ ${service.price.toFixed(2).replace('.', ',')}`).join('\n')}\n\nSe quiser agendar, me diga o serviço e o dia que prefere.`;
  }
  return `Olá! Sou o atendimento virtual do ${salon.name}. Posso ajudar com serviços, valores e agendamentos. Qual atendimento você procura?`;
}

async function safeFallback(input: { salon: AgentSalon; phone: string; text: string }, services: Awaited<ReturnType<typeof listServices>>) {
  if (asksForHuman(input.text)) await openHumanHandoff(input.salon.id, input.phone, 'Solicitação direta durante fallback do provider.');
  return fallbackReply(input.salon, input.text, services);
}

function resultMessage(result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  const message = (result as Record<string, unknown>).message;
  return typeof message === 'string' ? message.trim() : '';
}

function resultOk(result: unknown) {
  return Boolean(result && typeof result === 'object' && !Array.isArray(result) && (result as Record<string, unknown>).ok === true);
}

function resultRequiresConfirmation(result: unknown) {
  return Boolean(result && typeof result === 'object' && !Array.isArray(result) && (result as Record<string, unknown>).requiresConfirmation === true);
}

async function resolvePendingAction(input: { salon: AgentSalon; phone: string; text: string }) {
  const pending = await pendingActionForPhone(input.salon.id, input.phone);
  if (!pending) return null;

  const decision = confirmationDecision(input.text);
  if (decision === 'CANCEL') {
    await recordPendingActionState({
      salonId: input.salon.id,
      phone: input.phone,
      pendingActionId: pending.id,
      type: pending.type,
      summary: pending.summary,
      state: 'CANCELED'
    });
    return 'A ação foi cancelada e nenhuma alteração foi feita na agenda.';
  }

  if (decision !== 'CONFIRM') return pendingActionPrompt(pending);

  try {
    const result = await runConfirmedAction(pending, input.salon, input.phone);
    await recordPendingActionState({
      salonId: input.salon.id,
      phone: input.phone,
      pendingActionId: pending.id,
      type: pending.type,
      summary: pending.summary,
      state: resultOk(result) ? 'COMPLETED' : 'FAILED',
      result
    });
    return resultMessage(result) || (resultOk(result)
      ? 'A ação foi concluída.'
      : 'Não consegui concluir a ação porque os dados da agenda mudaram. Posso consultar novamente.');
  } catch {
    await recordPendingActionState({
      salonId: input.salon.id,
      phone: input.phone,
      pendingActionId: pending.id,
      type: pending.type,
      summary: pending.summary,
      state: 'FAILED'
    });
    return 'Não consegui concluir a ação. Nenhum sucesso foi registrado; posso consultar a agenda novamente.';
  }
}

/**
 * Orquestra provider, histórico e ferramentas. Mutações nunca são autorizadas
 * pelo booleano produzido pelo modelo: a confirmação é resolvida primeiro no
 * servidor a partir de uma proposta persistida e da mensagem seguinte.
 */
export async function answerWhatsAppMessage(input: {
  salon: AgentSalon;
  phone: string;
  clientName?: string;
  text: string;
}) {
  const pendingResolution = await resolvePendingAction(input);
  if (pendingResolution) return pendingResolution;

  const runtime = getAIRuntimeConfig();
  const history = await conversationHistory(input.salon.id, input.phone);
  const services = await listServices(input.salon.id);

  if (!runtime.configured) return safeFallback(input, services);

  const cleanHistory = [...history];
  const last = cleanHistory[cleanHistory.length - 1];
  if (last?.direction === 'IN' && last.text.trim() === input.text.trim()) cleanHistory.pop();

  const instructions = [
    `Você é o atendente virtual do salão ${input.salon.name}. Responda sempre em português do Brasil, de forma curta, cordial e natural para WhatsApp.`,
    buildSalonKnowledgeBase(input.salon, services),
    'Nunca invente preço, serviço, profissional, disponibilidade, política ou agendamento. Para disponibilidade e profissionais, use obrigatoriamente as ferramentas.',
    'Ferramentas de criar, cancelar e reagendar apenas PREPARAM uma proposta. Depois da proposta, pare e deixe o servidor pedir CONFIRMAR ao cliente. Nunca diga que a agenda foi alterada antes de receber o resultado de execução do servidor em uma mensagem posterior.',
    'Se houver dúvida, reclamação, situação fora do escopo ou pedido por pessoa, use transferir_para_humano.',
    'Não revele IDs internos ao cliente. Use-os apenas nas chamadas de ferramenta.',
    `Cliente atual: ${input.clientName || 'nome ainda não informado'}; telefone: ${normalizePhone(input.phone)}.`
  ].join('\n\n');

  const contextItems: Array<Record<string, unknown>> = cleanHistory.map((message) => ({
    role: message.direction === 'IN' ? 'user' : 'assistant',
    content: message.text
  }));
  contextItems.push({ role: 'user', content: input.text });

  let response: AIResponse;
  try {
    response = await requestAIResponse({ instructions, input: contextItems, tools, tool_choice: 'auto', parallel_tool_calls: false });
  } catch {
    return safeFallback(input, services);
  }

  let lastToolMessage = '';

  for (let round = 0; round < 4; round += 1) {
    const calls = functionCalls(response);
    if (!calls.length) break;

    contextItems.push(...(response.output || []).map((item) => ({ ...item })));
    const outputs: Array<Record<string, unknown>> = [];

    for (const call of calls) {
      let args: ToolArgs = {};
      try {
        const parsed: unknown = JSON.parse(call.arguments);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as ToolArgs;
      } catch {
        args = {};
      }
      const result = await runTool(call.name, args, input.salon, input.phone);
      lastToolMessage = resultMessage(result) || lastToolMessage;
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });

      // Uma proposta de mutação encerra imediatamente o turno. Isso impede que
      // o próprio modelo encadeie proposta + execução no mesmo ciclo de tools.
      if (resultRequiresConfirmation(result)) return lastToolMessage;
    }
    contextItems.push(...outputs);

    try {
      response = await requestAIResponse({ instructions, input: contextItems, tools, tool_choice: 'auto', parallel_tool_calls: false });
    } catch {
      return lastToolMessage || await safeFallback(input, services);
    }
  }

  return responseText(response) || lastToolMessage || `Posso ajudar com os serviços e a agenda do ${input.salon.name}. O que você gostaria de fazer?`;
}
