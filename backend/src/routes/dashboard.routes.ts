import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

/** Indicadores executivos para painel do administrador. */
export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/admin/summary', async (request) => {
    const tenant = getTenant(request);
    const [services, professionals, portfolioItems, appointments, inventoryProducts, lowStock] = await Promise.all([
      prisma.service.count({ where: { salonId: tenant.salonId } }),
      prisma.professional.count({ where: { salonId: tenant.salonId } }),
      prisma.portfolioItem.count({ where: { salonId: tenant.salonId } }),
      prisma.appointment.count({ where: { salonId: tenant.salonId } }),
      prisma.inventoryProduct.count({ where: { salonId: tenant.salonId } }),
      prisma.inventoryProduct.count({ where: { salonId: tenant.salonId, active: true, quantity: { lte: 3 } } })
    ]);
    return { services, professionals, portfolioItems, appointments, inventoryProducts, lowStock };
  });
}
