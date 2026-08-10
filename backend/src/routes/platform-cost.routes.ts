import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  getExternalCostSnapshot,
  recordExternalCostEntry,
  removeExternalCostEntry,
  saveExternalCostPolicy
} from '../services/external-cost-control.service';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido.');
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido. Use YYYY-MM.');
const policySchema = z.object({
  monthlyLimitBr: z.coerce.number().min(0).max(100000),
  warningPercent: z.coerce.number().min(1).max(100).default(80),
  domainMonthlyBr: z.coerce.number().min(0).max(10000).default(0)
});
const entrySchema = z.object({
  provider: z.enum(['META', 'AI', 'OTHER']),
  amountBr: z.coerce.number().min(0).max(100000),
  description: z.string().min(2).max(300),
  periodKey: periodSchema.optional()
});

async function salonExists(id: string) {
  const salon = await prisma.salon.findUnique({ where: { id }, select: { id: true, slug: true } });
  return Boolean(salon && salon.slug !== 'glossflow-platform');
}

/** Controle financeiro dos custos externos incluídos na mensalidade do cliente. */
export async function platformCostRoutes(app: FastifyInstance) {
  app.get('/platform-admin/salons/:id/external-costs', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const query = z.object({ period: periodSchema.optional() }).parse(request.query);
    if (!await salonExists(id)) return reply.status(404).send({ message: 'Salão não encontrado.' });
    return getExternalCostSnapshot(id, query.period);
  });

  app.put('/platform-admin/salons/:id/external-cost-policy', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const policy = policySchema.parse(request.body);
    if (!await salonExists(id)) return reply.status(404).send({ message: 'Salão não encontrado.' });
    const saved = await saveExternalCostPolicy(id, policy);
    return { ok: true, policy: saved };
  });

  app.post('/platform-admin/salons/:id/external-costs', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = entrySchema.parse(request.body);
    if (!await salonExists(id)) return reply.status(404).send({ message: 'Salão não encontrado.' });
    const created = await recordExternalCostEntry({ salonId: id, ...data });
    return reply.status(201).send({ ok: true, id: created.id });
  });

  app.delete('/platform-admin/salons/:id/external-costs/:entryId', async (request, reply) => {
    const { id, entryId } = z.object({ id: objectIdSchema, entryId: objectIdSchema }).parse(request.params);
    if (!await salonExists(id)) return reply.status(404).send({ message: 'Salão não encontrado.' });
    const removed = await removeExternalCostEntry(id, entryId);
    if (!removed) return reply.status(404).send({ message: 'Lançamento não encontrado.' });
    return { ok: true };
  });
}
