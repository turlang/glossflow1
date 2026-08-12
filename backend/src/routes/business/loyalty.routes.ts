import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { loyaltyEntrySchema, loyaltyProgramSchema } from '../schemas';
import { businessAdminOnly, businessAdminOrReception } from './access';

/** Fidelidade e pontos do tenant. */
export async function businessLoyaltyRoutes(app: FastifyInstance) {
  app.get('/admin/loyalty', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    const [program, entries] = await Promise.all([
      prisma.loyaltyProgram.findUnique({ where: { salonId: tenant.salonId } }),
      prisma.loyaltyEntry.findMany({
        where: { salonId: tenant.salonId },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return { program, entries };
  });

  app.put('/admin/loyalty/program', businessAdminOnly, async (request) => {
    const tenant = getTenant(request);
    const data = loyaltyProgramSchema.parse(request.body);
    return prisma.loyaltyProgram.upsert({
      where: { salonId: tenant.salonId },
      create: { ...data, salonId: tenant.salonId },
      update: data
    });
  });

  app.post('/admin/loyalty/entries', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = loyaltyEntrySchema.parse(request.body);
    const client = await prisma.client.findFirst({ where: { id: data.clientId, salonId: tenant.salonId } });
    if (!client) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return reply.status(201).send(await prisma.loyaltyEntry.create({ data: { ...data, salonId: tenant.salonId } }));
  });
}
