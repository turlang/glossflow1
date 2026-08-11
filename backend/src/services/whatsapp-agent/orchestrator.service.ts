import { AIResponse, getAIRuntimeConfig, requestAIResponse } from '../ai-provider.service';
import { conversationHistory, openHumanHandoff } from './conversation.repository';
import { AgentSalon, normalizePhone, ResponseFunctionCall, ToolArgs } from './contracts';
import { listServices } from './appointment-tools.service';
import { runTool, tools } from './tools';

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

/**
 * Orquestra provider, histórico e ferramentas sem misturar persistência ou
 * regras de Agenda. Falha do provider preserva um fallback útil e seguro.
 */
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
