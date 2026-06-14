import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getMainSalon } from './helpers';

/** Rotas públicas usadas pela vitrine e pelo fluxo de agendamento do cliente. */
export async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, app: 'GlossFlow API' }));

  app.get('/public/salon', async () => getMainSalon());

  app.get('/services', async () => {
    const salon = await getMainSalon();
    return prisma.service.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
  });

  app.get('/professionals', async () => {
    const salon = await getMainSalon();
    return prisma.professional.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
  });

  app.get('/portfolio', async () => {
    const salon = await getMainSalon();
    return prisma.portfolioItem.findMany({ where: { salonId: salon.id }, orderBy: { createdAt: 'desc' } });
  });

  app.get('/inventory/summary', async () => {
    const salon = await getMainSalon();
    const products = await prisma.inventoryProduct.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: 'asc' } });
    const lowStock = products.filter((product: any) => product.quantity <= product.minimumQuantity);
    const totalCostValue = products.reduce((sum: number, product: any) => sum + (product.quantity * product.costPrice), 0);
    return { products, lowStock, totalCostValue };
  });
}
