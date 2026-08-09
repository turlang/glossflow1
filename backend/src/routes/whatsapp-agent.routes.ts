import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import {
  answerWhatsAppMessage,
  closeHumanHandoff,
  hasOpenHumanHandoff,
  normalizePhone,
  saveWhatsAppMessage
} from '../services/whatsapp-agent.service';

/** Rotas administrativas para homologar e operar o agente sem depender do webhook real. */
export async function whatsappAgentRoutes(app: FastifyInstance) {
  app.get('/admin/whatsapp/agent-status', async (request) => {
    const tenant = getTenant(request);
    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId } });
    return {
      salon: salon ? { id: salon.id, name: salon.name, whatsapp: salon.whatsapp } : null,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
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

    await saveWhatsAppMessage({ salonId: salon.id, phone: body.phone, direction: 'IN', text: body.message });
    const answer = await answerWhatsAppMessage({ salon, phone: body.phone, clientName: body.clientName, text: body.message });
    await saveWhatsAppMessage({ salonId: salon.id, phone: body.phone, direction: 'OUT', text: answer });
    return { ok: true, dryRun: true, answer };
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
