import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { clientSchema, objectIdSchema } from '../schemas';
import { businessAdminOrReception } from './access';

/** CRM administrativo isolado por salonId. */
export async function businessClientRoutes(app: FastifyInstance) {
  app.get('/admin/clients', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    return prisma.client.findMany({
      where: { salonId: tenant.salonId },
      include: {
        loyaltyEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
        appointments: { orderBy: { startTime: 'desc' }, take: 5 }
      },
      orderBy: { name: 'asc' }
    });
  });

  app.post('/admin/clients', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = clientSchema.parse(request.body);
    return reply.status(201).send(await prisma.client.create({
      data: {
        ...data,
        email: data.email || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        salonId: tenant.salonId
      }
    }));
  });

  app.put('/admin/clients/:id', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = clientSchema.parse(request.body);
    const result = await prisma.client.updateMany({
      where: { id, salonId: tenant.salonId },
      data: {
        ...data,
        email: data.email || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null
      }
    });
    if (result.count === 0) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return prisma.client.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/clients/:id', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.client.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return reply.status(204).send();
  });
}
