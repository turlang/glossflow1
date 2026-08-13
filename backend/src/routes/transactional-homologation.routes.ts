import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

function forbidden(message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  return error;
}

function requireAdmin(request: FastifyRequest) {
  const tenant = getTenant(request);
  if (tenant.role !== 'ADMIN') throw forbidden('Esta operação exige o papel ADMIN.');
  return tenant;
}

function expectedMovementQuantity(items: unknown) {
  const parsed = z.array(z.object({ productId: objectId, quantity: z.coerce.number().int().positive() }).passthrough()).safeParse(items);
  if (!parsed.success) return new Map<string, number>();
  const expected = new Map<string, number>();
  for (const item of parsed.data) expected.set(item.productId, (expected.get(item.productId) || 0) + item.quantity);
  return expected;
}

/** Marco 35: diagnóstico somente leitura do fluxo PDV → Estoque → Compras → Financeiro → Pacotes. */
export async function transactionalHomologationRoutes(app: FastifyInstance) {
  app.get('/admin/homologation/transactional', async (request) => {
    const current = requireAdmin(request);
    const salonId = current.salonId;
    const [sales, purchaseOrders, clientPackages] = await Promise.all([
      prisma.sale.findMany({ where: { salonId }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.purchaseOrder.findMany({ where: { salonId }, orderBy: { orderedAt: 'desc' }, take: 100 }),
      prisma.clientPackage.findMany({ where: { salonId }, take: 200 })
    ]);

    const findings: Array<{ severity: 'ERROR' | 'WARN'; domain: string; reference: string; message: string }> = [];

    for (const sale of sales) {
      const revenue = await prisma.financialEntry.findFirst({ where: { salonId, type: 'REVENUE', category: 'PDV', description: `Venda ${sale.number}` } });
      if (!revenue && sale.status !== 'REFUNDED') findings.push({ severity: 'ERROR', domain: 'POS_FINANCE', reference: sale.number, message: 'Venda paga sem lançamento financeiro PDV correspondente.' });

      for (const item of sale.items.filter((entry) => entry.kind === 'PRODUCT' && entry.inventoryProductId)) {
        const movement = await prisma.inventoryMovement.findFirst({ where: { salonId, productId: item.inventoryProductId!, type: 'OUT', reason: `Venda ${sale.number}` } });
        if (!movement || movement.quantity < item.quantity) findings.push({ severity: 'ERROR', domain: 'POS_STOCK', reference: sale.number, message: `Baixa de estoque ausente/incompleta para ${item.description}.` });

        if (sale.status === 'REFUNDED') {
          const restored = await prisma.inventoryMovement.findFirst({ where: { salonId, productId: item.inventoryProductId!, type: 'IN', reason: `Estorno ${sale.number}` } });
          if (!restored || restored.quantity < item.quantity) findings.push({ severity: 'ERROR', domain: 'POS_REFUND_STOCK', reference: sale.number, message: `Estorno sem reposição completa de estoque para ${item.description}.` });
        }
      }

      if (sale.status === 'REFUNDED') {
        const refund = await prisma.financialEntry.findFirst({ where: { salonId, type: 'EXPENSE', category: 'REFUND', description: `Estorno ${sale.number}` } });
        if (!refund) findings.push({ severity: 'ERROR', domain: 'POS_REFUND', reference: sale.number, message: 'Venda estornada sem lançamento financeiro de estorno.' });
      }
    }

    for (const order of purchaseOrders.filter((entry) => entry.status === 'RECEIVED')) {
      const expected = expectedMovementQuantity(order.items);
      for (const [productId, quantity] of expected.entries()) {
        const movements = await prisma.inventoryMovement.findMany({ where: { salonId, productId, type: 'IN', reason: `Recebimento ${order.number}` } });
        const received = movements.reduce((sum, movement) => sum + movement.quantity, 0);
        if (received < quantity) findings.push({ severity: 'ERROR', domain: 'PROCUREMENT_STOCK', reference: order.number, message: `Recebimento de estoque incompleto para produto ${productId}.` });
      }

      const payable = await prisma.receivablePayable.findFirst({ where: { salonId, type: 'PAYABLE', description: { contains: order.number } } });
      if (!payable) findings.push({ severity: 'WARN', domain: 'PROCUREMENT_FINANCE', reference: order.number, message: 'Pedido recebido sem conta a pagar identificável pelo número do pedido.' });
    }

    const now = new Date();
    for (const item of clientPackages) {
      if (item.remainingCredits < 0) findings.push({ severity: 'ERROR', domain: 'PACKAGES', reference: item.id, message: 'Pacote com saldo de créditos negativo.' });
      if (item.status === 'ACTIVE' && item.expiresAt <= now) findings.push({ severity: 'WARN', domain: 'PACKAGES', reference: item.id, message: 'Pacote vencido ainda marcado como ACTIVE.' });
      if (item.status === 'CONSUMED' && item.remainingCredits !== 0) findings.push({ severity: 'ERROR', domain: 'PACKAGES', reference: item.id, message: 'Pacote CONSUMED possui saldo diferente de zero.' });
    }

    const errors = findings.filter((finding) => finding.severity === 'ERROR').length;
    const warnings = findings.filter((finding) => finding.severity === 'WARN').length;
    return { ok: errors === 0, checkedAt: new Date().toISOString(), scope: { sales: sales.length, purchaseOrders: purchaseOrders.length, clientPackages: clientPackages.length }, summary: { errors, warnings, findings: findings.length }, findings };
  });
}
