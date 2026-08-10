import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getPublicSalon } from './helpers';

/** Rotas públicas usadas pela vitrine e pelo fluxo de agendamento do cliente. */
export async function publicRoutes(app: FastifyInstance) {
  app.get('/public/salon', async (request) => getPublicSalon(request));

  app.get('/services', async (request) => {
    const salon = await getPublicSalon(request);
    return prisma.service.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
  });

  app.get('/professionals', async (request) => {
    const salon = await getPublicSalon(request);
    return prisma.professional.findMany({
      where: { salonId: salon.id, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        specialty: true,
        bio: true,
        photoUrl: true,
        active: true,
        servicesConfigured: true,
        serviceIds: true,
        createdAt: true,
        updatedAt: true
      }
    });
  });

  app.get('/portfolio', async (request) => {
    const salon = await getPublicSalon(request);
    return prisma.portfolioItem.findMany({ where: { salonId: salon.id }, orderBy: { createdAt: 'desc' } });
  });

  /**
   * Compatibilidade temporária com builds antigos do frontend.
   * Dados de estoque são administrativos e nunca devem ser expostos na vitrine.
   */
  app.get('/inventory/summary', async () => ({
    products: [],
    lowStock: [],
    totalCostValue: 0,
    message: 'Estoque disponível somente no painel administrativo.'
  }));
}
