import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireRoles } from '../middlewares/auth';
import { getTenant } from './helpers';
import { objectIdSchema } from './schemas';

type InventorySnapshot = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  unit: string;
  quantity: number;
  minimumQuantity: number;
  costPrice: number;
  salePrice: number | null;
};

function needsRestock(product: InventorySnapshot) {
  return product.minimumQuantity > 0 && product.quantity <= product.minimumQuantity;
}

function recommendedPurchase(product: InventorySnapshot) {
  if (!needsRestock(product)) return 0;
  const target = product.minimumQuantity * 2;
  return Math.max(target - product.quantity, 1);
}

/**
 * Read models operacionais do estoque.
 * Mutação continua centralizada nas rotas CRUD existentes; aqui expomos apenas
 * visão consolidada e histórico completo sob demanda para evitar payloads
 * grandes em toda abertura do painel.
 */
export async function inventoryOperationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION']));

  app.get('/admin/inventory/overview', async (request) => {
    const tenant = getTenant(request);
    const products = await prisma.inventoryProduct.findMany({
      where: { salonId: tenant.salonId, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        supplier: true,
        unit: true,
        quantity: true,
        minimumQuantity: true,
        costPrice: true,
        salePrice: true
      }
    });

    const restock = products
      .filter(needsRestock)
      .map((product) => {
        const recommendedQuantity = recommendedPurchase(product);
        return {
          ...product,
          status: product.quantity === 0 ? 'OUT' : 'LOW',
          recommendedQuantity,
          estimatedCost: recommendedQuantity * Number(product.costPrice || 0)
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'OUT' ? -1 : 1;
        return a.name.localeCompare(b.name, 'pt-BR');
      });

    const totalCostValue = products.reduce(
      (sum, product) => sum + product.quantity * Number(product.costPrice || 0),
      0
    );
    const potentialSaleValue = products.reduce(
      (sum, product) => sum + product.quantity * Number(product.salePrice || 0),
      0
    );
    const estimatedRestockCost = restock.reduce((sum, item) => sum + item.estimatedCost, 0);

    return {
      summary: {
        activeProducts: products.length,
        lowStock: products.filter(needsRestock).length,
        outOfStock: products.filter((product) => product.quantity === 0).length,
        totalCostValue,
        potentialSaleValue,
        estimatedRestockCost
      },
      restock
    };
  });

  app.get('/admin/inventory/:id/movements', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const product = await prisma.inventoryProduct.findFirst({
      where: { id, salonId: tenant.salonId },
      select: { id: true, name: true, unit: true, quantity: true, active: true }
    });

    if (!product) {
      return reply.status(404).send({ message: 'Produto não encontrado neste salão.' });
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: id, salonId: tenant.salonId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return { product, movements };
  });
}
