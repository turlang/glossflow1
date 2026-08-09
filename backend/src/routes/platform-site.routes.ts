import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { salonSchema } from './schemas';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de salão inválido.');

function normalizeDomain(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
}

/**
 * Site & Marca é uma responsabilidade da plataforma.
 * Estas rotas são registradas dentro do grupo SUPER_ADMIN em appRoutes.ts.
 * O ADMIN do salão apenas opera os módulos contratados e não publica a marca.
 */
export async function platformSiteRoutes(app: FastifyInstance) {
  app.get('/platform-admin/salons/:id/site', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon || salon.slug === 'glossflow-platform') {
      return reply.status(404).send({ message: 'Salão não encontrado.' });
    }

    const [services, professionals] = await Promise.all([
      prisma.service.findMany({ where: { salonId: id, active: true }, orderBy: { name: 'asc' }, take: 12 }),
      prisma.professional.findMany({ where: { salonId: id, active: true }, orderBy: { name: 'asc' }, take: 12 })
    ]);

    return { salon, services, professionals };
  });

  app.put('/platform-admin/salons/:id/site', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const current = await prisma.salon.findUnique({ where: { id } });
    if (!current || current.slug === 'glossflow-platform') {
      return reply.status(404).send({ message: 'Salão não encontrado.' });
    }

    const data = salonSchema.parse(request.body);
    const customDomain = normalizeDomain(data.customDomain);

    if (customDomain) {
      const collision = await prisma.salon.findFirst({
        where: { id: { not: id }, customDomain }
      });
      if (collision) {
        return reply.status(409).send({ message: 'Este domínio já está vinculado a outro salão.' });
      }
    }

    const updated = await prisma.salon.update({
      where: { id },
      data: {
        ...data,
        customDomain: customDomain || null
      }
    });

    return updated;
  });
}
