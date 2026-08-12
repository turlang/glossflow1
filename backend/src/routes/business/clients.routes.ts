import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { clientSchema, objectIdSchema } from '../schemas';
import { businessAdminOrReception } from './access';

const clientsPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50)
});

const clientRelations = {
  loyaltyEntries: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  appointments: { orderBy: { startTime: 'desc' as const }, take: 5 }
};

/** CRM administrativo isolado por salonId. */
export async function businessClientRoutes(app: FastifyInstance) {
  /**
   * Contrato paginado para telas que precisam escalar além do piloto.
   * O GET legado abaixo é preservado para compatibilidade com a UI atual.
   */
  app.get('/admin/clients/paginated', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    const { page, limit } = clientsPageQuerySchema.parse(request.query);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where: { salonId: tenant.salonId },
        include: clientRelations,
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.client.count({ where: { salonId: tenant.salonId } })
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNext: skip + items.length < total,
        hasPrevious: page > 1
      }
    };
  });

  app.get('/admin/clients', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    return prisma.client.findMany({
      where: { salonId: tenant.salonId },
      include: clientRelations,
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
