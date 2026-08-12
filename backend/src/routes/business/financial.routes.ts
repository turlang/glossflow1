import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { financialEntrySchema, objectIdSchema } from '../schemas';
import { businessAdminOnly } from './access';

/** Lançamentos financeiros do tenant. */
export async function businessFinancialRoutes(app: FastifyInstance) {
  app.get('/admin/financial', businessAdminOnly, async (request) => {
    const tenant = getTenant(request);
    return prisma.financialEntry.findMany({
      where: { salonId: tenant.salonId },
      orderBy: { referenceDate: 'desc' }
    });
  });

  app.post('/admin/financial', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const data = financialEntrySchema.parse(request.body);
    return reply.status(201).send(await prisma.financialEntry.create({
      data: {
        ...data,
        paymentMethod: data.paymentMethod || null,
        referenceDate: data.referenceDate ? new Date(data.referenceDate) : new Date(),
        salonId: tenant.salonId
      }
    }));
  });

  app.put('/admin/financial/:id', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = financialEntrySchema.parse(request.body);
    const result = await prisma.financialEntry.updateMany({
      where: { id, salonId: tenant.salonId },
      data: {
        ...data,
        paymentMethod: data.paymentMethod || null,
        referenceDate: data.referenceDate ? new Date(data.referenceDate) : new Date()
      }
    });
    if (result.count === 0) return reply.status(404).send({ message: 'Lançamento financeiro não encontrado neste salão.' });
    return prisma.financialEntry.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/financial/:id', businessAdminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.financialEntry.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Lançamento financeiro não encontrado neste salão.' });
    return reply.status(204).send();
  });
}
