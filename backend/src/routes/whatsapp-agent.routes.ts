import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getAIRuntimeConfig } from '../services/ai-provider.service';
import { availabilityClarification } from '../services/agent-intent.service';
import { guardAgentReply } from '../services/agent-response-guard.service';
import { hasSalonModule } from '../services/module-access.service';
import { getTenant } from './helpers';
import {
  answerWhatsAppMessage,
  closeHumanHandoff,
  hasOpenHumanHandoff,
  normalizePhone,
  saveWhatsAppMessage
} from '../services/whatsapp-agent.service';

async function getAgentEntitlements(salonId: string) {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { modulesConfigured: true, enabledModules: true }
  });
  return {
    whatsapp: Boolean(salon && hasSalonModule(salon, 'WHATSAPP')),
    ai: Boolean(salon && hasSalonModule(salon, 'IA')),
    agenda: Boolean(salon && hasSalonModule(salon, 'AGENDA'))
  };
}

function agentError(error: unknown) {
  const runtime = getAIRuntimeConfig();
  const raw = error instanceof Error ? error.message : String(error || 'Erro desconhecido.');
  const text = raw.toLowerCase();
  const label = runtime.providerLabel;

  if (text.includes('incorrect api key') || text.includes('invalid_api_key') || (text.includes('api key') && text.includes('invalid'))) {
    return {
      status: 502,
      code: 'AI_INVALID_KEY',
      message: `A chave ${runtime.apiKeyEnv} configurada no Render não foi aceita pela ${label}. Confira a chave e salve novamente.`
    };
  }

  if (text.includes('insufficient_quota') || text.includes('quota') || text.includes('billing') || text.includes('credit balance')) {
    return {
      status: 402,
      code: 'AI_QUOTA',
      message: `${label} recusou a chamada por limite de créditos/cota do provedor. Verifique a conta associada à ${runtime.apiKeyEnv}.`
    };
  }

  if (text.includes('rate limit') || text.includes('http 429') || text.includes('too many requests')) {
    return {
      status: 429,
      code: 'AI_RATE_LIMIT',
      message: `${label} aplicou um limite temporário de requisições. Aguarde alguns instantes e teste novamente.`
    };
  }

  if ((text.includes('model') && text.includes('not found')) || text.includes('model_not_found') || text.includes('does not exist') || text.includes('unsupported model') || text.includes('decommissioned')) {
    return {
      status: 502,
      code: 'AI_MODEL_ERROR',
      message: `O modelo configurado (${runtime.model}) não está disponível no provedor ${label}.`
    };
  }

  if (text.includes('http 400') || text.includes('bad request')) {
    return {
      status: 502,
      code: 'AI_REQUEST_INVALID',
      message: `${label} rejeitou o formato da solicitação do agente. O erro técnico foi registrado no backend para correção.`
    };
  }

  if (text.includes('groq') || text.includes('openai') || text.includes('api.groq.com') || text.includes('api.openai.com')) {
    return {
      status: 502,
      code: 'AI_UPSTREAM_ERROR',
      message: `A chamada ao provedor ${label} falhou. Verifique a chave, o modelo e os limites da conta.`
    };
  }

  return {
    status: 500,
    code: 'AGENT_INTERNAL_ERROR',
    message: 'O agente encontrou uma falha interna ao preparar a resposta. O detalhe técnico foi registrado no backend.'
  };
}

/** Rotas administrativas para homologar e operar o agente sem depender do webhook real. */
export async function whatsappAgentRoutes(app: FastifyInstance) {
  app.get('/admin/whatsapp/agent-status', async (request) => {
    const tenant = getTenant(request);
    const runtime = getAIRuntimeConfig();
    const [salon, entitlements] = await Promise.all([
      prisma.salon.findUnique({ where: { id: tenant.salonId } }),
      getAgentEntitlements(tenant.salonId)
    ]);
    return {
      salon: salon ? { id: salon.id, name: salon.name, whatsapp: salon.whatsapp } : null,
      modules: entitlements,
      agentEnabled: entitlements.whatsapp && entitlements.ai && entitlements.agenda,
      aiProvider: runtime.provider,
      aiProviderLabel: runtime.providerLabel,
      aiConfigured: runtime.configured,
      aiModel: runtime.model,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      whatsappTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
      phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
      webhookVerifyTokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      webhookSignatureConfigured: Boolean(process.env.WHATSAPP_APP_SECRET),
      dryRun: process.env.WHATSAPP_DRY_RUN !== 'false',
      webhookPath: '/webhooks/whatsapp'
    };
  });

  app.post('/admin/whatsapp/agent-test', async (request, reply) => {
    const tenant = getTenant(request);
    const runtime = getAIRuntimeConfig();
    const entitlements = await getAgentEntitlements(tenant.salonId);
    if (!entitlements.whatsapp || !entitlements.ai || !entitlements.agenda) {
      return reply.status(403).send({
        message: 'O agente WhatsApp exige os módulos WhatsApp, Inteligência Artificial e Agenda habilitados.',
        code: 'MODULE_DEPENDENCY_DISABLED'
      });
    }

    if (!runtime.configured) {
      return reply.status(503).send({
        message: `O provedor ${runtime.providerLabel} está selecionado, mas ${runtime.apiKeyEnv} não está configurada.`,
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        provider: runtime.provider,
        model: runtime.model
      });
    }

    const body = z.object({
      phone: z.string().min(10),
      clientName: z.string().min(2).optional().default('Cliente Teste'),
      message: z.string().min(1).max(1500)
    }).parse(request.body);

    const salon = await prisma.salon.findUnique({
      where: { id: tenant.salonId },
      select: { id: true, name: true, description: true, whatsapp: true, openingHours: true }
    });
    if (!salon) return reply.status(404).send({ message: 'Salão não encontrado.' });

    if (await hasOpenHumanHandoff(salon.id, body.phone)) {
      return reply.status(409).send({ message: 'Este telefone está em atendimento humano. Feche o handoff para retomar a IA.' });
    }

    try {
      await saveWhatsAppMessage({ salonId: salon.id, phone: body.phone, direction: 'IN', text: body.message });
      const clarification = await availabilityClarification(salon.id, body.message);
      const rawAnswer = clarification || await answerWhatsAppMessage({ salon, phone: body.phone, clientName: body.clientName, text: body.message });
      const guarded = await guardAgentReply({ salonId: salon.id, phone: body.phone, userText: body.message, replyText: rawAnswer });
      const answer = guarded.replyText;
      await saveWhatsAppMessage({ salonId: salon.id, phone: body.phone, direction: 'OUT', text: answer });
      return {
        ok: true,
        dryRun: true,
        provider: runtime.provider,
        providerLabel: runtime.providerLabel,
        model: runtime.model,
        handoffBlocked: guarded.handoffBlocked,
        answer
      };
    } catch (error) {
      const diagnostic = agentError(error);
      request.log.error({
        err: error,
        salonId: salon.id,
        diagnosticCode: diagnostic.code,
        aiProvider: runtime.provider,
        aiModel: runtime.model
      }, 'Falha no teste do agente de WhatsApp/IA');
      return reply.status(diagnostic.status).send({
        message: diagnostic.message,
        code: diagnostic.code,
        provider: runtime.provider,
        model: runtime.model
      });
    }
  });

  app.get('/admin/whatsapp/handoffs', async (request) => {
    const tenant = getTenant(request);
    const events = await prisma.auditLog.findMany({
      where: { salonId: tenant.salonId, resource: 'WhatsAppHandoff' },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { action: true, resourceId: true, metadata: true, createdAt: true }
    });

    const latestByPhone = new Map<string, typeof events[number]>();
    for (const event of events) {
      const phone = normalizePhone(event.resourceId || '');
      if (phone && !latestByPhone.has(phone)) latestByPhone.set(phone, event);
    }

    return [...latestByPhone.entries()]
      .filter(([, event]) => event.action === 'HANDOFF_OPEN')
      .map(([phone, event]) => ({ phone, openedAt: event.createdAt, metadata: event.metadata }));
  });

  app.post('/admin/whatsapp/handoffs/:phone/close', async (request, reply) => {
    const tenant = getTenant(request);
    const { phone } = z.object({ phone: z.string().min(10) }).parse(request.params);
    const normalized = normalizePhone(phone);
    if (!await hasOpenHumanHandoff(tenant.salonId, normalized)) {
      return reply.status(404).send({ message: 'Não há atendimento humano aberto para este telefone.' });
    }
    await closeHumanHandoff(tenant.salonId, normalized);
    return { ok: true, phone: normalized, message: 'Atendimento humano encerrado. A IA pode voltar a responder.' };
  });
}
