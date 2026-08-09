import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

/** Dados do salão autenticado. Nunca depende do tenant público/hostname. */
export async function tenantRoutes(app: FastifyInstance) {
  app.get('/admin/salon-info', async (request, reply) => {
    const tenant = getTenant(request);
    const salon = await prisma.salon.findUnique({ where: { id: tenant.salonId } });
    if (!salon) return reply.status(404).send({ message: 'Salão da sessão não encontrado.' });
    return salon;
  });
}
