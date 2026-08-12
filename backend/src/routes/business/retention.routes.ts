import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { objectIdSchema } from '../schemas';
import {
  getClientServiceHistory,
  getRetentionOverview,
  prepareRetentionFollowUp,
  recordRetentionFollowUpInitiated
} from '../../services/client-retention.service';
import { businessAdminOrReception } from './access';

const marketingConsentSchema = z.object({
  granted: z.boolean(),
  evidence: z.string().trim().max(300).optional().default('CRM GlossFlow')
}).strict();

function sendRetentionError(reply: Parameters<FastifyInstance['post']>[2] extends (...args: infer P) => unknown ? P[1] : never, result: { code: string }) {
  if (result.code === 'CLIENT_NOT_FOUND') return reply.status(404).send({ message: 'Cliente não encontrado neste salão.', code: result.code });
  if (result.code === 'MARKETING_OPT_OUT') return reply.status(409).send({ message: 'Cliente optou por não receber comunicações de marketing.', code: result.code });
  return reply.status(400).send({ message: 'Cliente sem telefone válido para WhatsApp.', code: result.code });
}

/**
 * Retenção fica sob /admin/clients para herdar o entitlement de CRM.
 * Nenhuma rota dispara campanha automática: o Marco 19 registra consentimento,
 * segmenta, prepara o conteúdo e audita quando a equipe inicia o contato.
 */
export async function businessRetentionRoutes(app: FastifyInstance) {
  app.get('/admin/clients/retention', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    return getRetentionOverview(tenant.salonId);
  });

  app.get('/admin/clients/:id/history', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const client = await getClientServiceHistory(tenant.salonId, id);
    if (!client) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return client;
  });

  app.post('/admin/clients/:id/marketing-consent', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = marketingConsentSchema.parse(request.body);
    const client = await prisma.client.findFirst({ where: { id, salonId: tenant.salonId }, select: { id: true } });
    if (!client) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });

    const consent = await prisma.lgpdConsent.create({
      data: {
        clientId: id,
        salonId: tenant.salonId,
        type: 'MARKETING',
        granted: data.granted,
        evidence: data.evidence
      }
    });
    return reply.status(201).send(consent);
  });

  app.post('/admin/clients/:id/follow-up', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prepareRetentionFollowUp(tenant.salonId, id);
    if (!result.ok) return sendRetentionError(reply, result);
    return result;
  });

  app.post('/admin/clients/:id/follow-up/contacted', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await recordRetentionFollowUpInitiated(tenant.salonId, id);
    if (!result.ok) return sendRetentionError(reply, result);
    return result;
  });
}
