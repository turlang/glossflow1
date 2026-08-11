import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getTenant } from '../helpers';
import { objectIdSchema, whatsappTemplateSchema } from '../schemas';
import { businessAdminOrReception } from './access';

/** Templates de comunicação do salão, sempre filtrados por tenant. */
export async function businessWhatsappTemplateRoutes(app: FastifyInstance) {
  app.get('/admin/whatsapp/templates', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    return prisma.whatsAppTemplate.findMany({
      where: { salonId: tenant.salonId },
      orderBy: { event: 'asc' }
    });
  });

  app.post('/admin/whatsapp/templates', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = whatsappTemplateSchema.parse(request.body);
    return reply.status(201).send(await prisma.whatsAppTemplate.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/whatsapp/templates/:id', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = whatsappTemplateSchema.parse(request.body);
    const result = await prisma.whatsAppTemplate.updateMany({ where: { id, salonId: tenant.salonId }, data });
    if (result.count === 0) return reply.status(404).send({ message: 'Template não encontrado neste salão.' });
    return prisma.whatsAppTemplate.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/whatsapp/templates/:id', businessAdminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.whatsAppTemplate.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Template não encontrado neste salão.' });
    return reply.status(204).send();
  });
}
