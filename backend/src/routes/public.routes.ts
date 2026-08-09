import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getPublicSalon } from './helpers';

/** Rotas públicas usadas pela vitrine e pelo fluxo de agendamento do cliente. */
export async function publicRoutes(app: FastifyInstance) {
  // A rota GET /health fica centralizada em platform.routes.ts.
  // Não declare health check aqui para evitar FST_ERR_DUPLICATED_ROUTE no Fastify.

  app.get('/public/salon', async (request) => getPublicSalon(request));

  app.get('/services', async (request) => {
    const salon = await getPublicSalon(request);
    return prisma.service.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
  });

  app.get('/professionals', async (request) => {
    const salon = await getPublicSalon(request);
    return prisma.professional.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
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
