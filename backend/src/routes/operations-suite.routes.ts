import { randomBytes, createHash } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
const money = z.coerce.number().finite().nonnegative();
const positiveMoney = z.coerce.number().finite().positive();
const positiveInt = z.coerce.number().int().positive();
const optionalDate = z.union([z.coerce.date(), z.literal(''), z.null()]).optional();

function badRequest(message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  return error;
}

function forbidden(message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  return error;
}

function tenantId(request: FastifyRequest) {
  return getTenant(request).salonId;
}

function requireAdmin(request: FastifyRequest) {
  const tenant = getTenant(request);
  if (tenant.role !== 'ADMIN') throw forbidden('Esta operação exige o papel ADMIN.');
  return tenant;
}

function toNullableDate(value: Date | '' | null | undefined) {
  return value instanceof Date ? value : null;
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function saleNumber() {
  return `VEN-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

function purchaseNumber() {
  return `PC-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

function giftCardCode() {
  return `GF-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export function calculateSaleTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discount = 0
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const normalizedDiscount = Math.min(Math.max(Number(discount || 0), 0), subtotal);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(normalizedDiscount.toFixed(2)),
    total: Number((subtotal - normalizedDiscount).toFixed(2))
  };
}

export function calculatePurchaseTotal(items: Array<{ quantity: number; unitCost: number }>) {
  return Number(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toFixed(2));
}

export function calculateReconciliation(expected: number, settled: number) {
  return Number((Number(settled) - Number(expected)).toFixed(2));
}

const saleItemSchema = z.object({
  kind: z.enum(['SERVICE', 'PRODUCT', 'PACKAGE', 'MEMBERSHIP', 'GIFT_CARD']).default('SERVICE'),
  description: z.string().min(1).max(180),
  quantity: positiveInt.default(1),
  unitPrice: positiveMoney,
  serviceId: objectId.optional(),
  inventoryProductId: objectId.optional(),
  professionalId: objectId.optional()
});

const salePaymentSchema = z.object({
  method: z.string().min(2).max(40),
  amount: positiveMoney,
  externalReference: z.string().max(120).optional()
});

const createSaleSchema = z.object({
  clientId: objectId.optional(),
  appointmentId: objectId.optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discount: money.default(0),
  notes: z.string().max(500).default('')
});

const packageOfferSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).default(''),
  price: positiveMoney,
  totalCredits: positiveInt,
  serviceIds: z.array(objectId).default([]),
  validityDays: z.coerce.number().int().min(1).max(3650).default(90),
  active: z.boolean().default(true)
});

const clientPackageSchema = z.object({ clientId: objectId, packageOfferId: objectId });
const membershipPlanSchema = z.object({
  name: z.string().min(2).max(120), description: z.string().max(500).default(''),
  monthlyPrice: positiveMoney, benefits: z.any().optional(), active: z.boolean().default(true)
});
const clientMembershipSchema = z.object({ clientId: objectId, planId: objectId, nextBillingAt: optionalDate });
const giftCardSchema = z.object({
  clientId: objectId.optional(), purchaserName: z.string().max(120).default(''),
  recipientName: z.string().max(120).default(''), amount: positiveMoney, expiresAt: optionalDate
});
const supplierSchema = z.object({
  name: z.string().min(2).max(140), document: z.string().max(40).default(''),
  phone: z.string().max(30).default(''), email: z.string().email().or(z.literal('')).default(''),
  contact: z.string().max(120).default(''), notes: z.string().max(500).default(''), active: z.boolean().default(true)
});
const purchaseItemSchema = z.object({ productId: objectId, description: z.string().min(1).max(160), quantity: positiveInt, unitCost: positiveMoney });
const purchaseOrderSchema = z.object({ supplierId: objectId, items: z.array(purchaseItemSchema).min(1), expectedAt: optionalDate, notes: z.string().max(500).default('') });
const timeClockSchema = z.object({ professionalId: objectId, type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']), occurredAt: optionalDate, notes: z.string().max(300).default('') });
const staffGoalSchema = z.object({ professionalId: objectId, metric: z.enum(['REVENUE', 'SERVICES', 'PRODUCT_SALES', 'RETENTION', 'OCCUPANCY']), target: positiveMoney, periodStart: z.coerce.date(), periodEnd: z.coerce.date() });
const payrollSchema = z.object({
  periodStart: z.coerce.date(), periodEnd: z.coerce.date(),
  entries: z.array(z.object({
    professionalId: objectId, professionalName: z.string().min(1).max(120), baseAmount: money.default(0),
    commissionAmount: money.default(0), bonusAmount: money.default(0), deductions: money.default(0)
  })).min(1), notes: z.string().max(500).default('')
});
const clinicalRecordSchema = z.object({
  clientId: objectId, appointmentId: objectId.optional(), recordType: z.enum(['ANAMNESIS', 'TREATMENT', 'EVOLUTION', 'CONSENT']).default('ANAMNESIS'),
  answers: z.any().optional(), allergies: z.string().max(1000).default(''), notes: z.string().max(3000).default(''),
  photoUrls: z.array(z.string().url()).max(20).default([]), signedBy: z.string().max(180).default(''), signedAt: optionalDate,
  consentText: z.string().max(5000).default('')
});
const campaignSchema = z.object({
  name: z.string().min(2).max(140), channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP']), segment: z.string().min(1).max(120).default('ALL'),
  message: z.string().min(2).max(3000), status: z.enum(['DRAFT', 'SCHEDULED']).default('DRAFT'), scheduledAt: optionalDate
});
const reviewSchema = z.object({ clientId: objectId, channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).default('WHATSAPP'), reviewUrl: z.string().url().or(z.literal('')).default('') });
const couponSchema = z.object({
  code: z.string().min(3).max(40).transform((value) => value.toUpperCase()), description: z.string().max(300).default(''),
  discountType: z.enum(['PERCENT', 'FIXED']).default('PERCENT'), discountValue: positiveMoney, startsAt: optionalDate,
  expiresAt: optionalDate, usageLimit: z.coerce.number().int().positive().optional(), active: z.boolean().default(true)
});
const portalAccessSchema = z.object({ clientId: objectId, expiresInHours: z.coerce.number().int().min(1).max(720).default(72) });
const organizationSchema = z.object({ name: z.string().min(2).max(160), document: z.string().max(40).default('') });
const locationSchema = z.object({ organizationId: objectId, locationSalonId: objectId, label: z.string().min(2).max(120) });
const resourceSchema = z.object({ name: z.string().min(2).max(120), type: z.enum(['ROOM', 'CHAIR', 'BED', 'EQUIPMENT', 'OTHER']), capacity: z.coerce.number().int().min(1).max(100).default(1), notes: z.string().max(500).default(''), active: z.boolean().default(true) });
const reservationSchema = z.object({ resourceId: objectId, appointmentId: objectId.optional(), startTime: z.coerce.date(), endTime: z.coerce.date(), notes: z.string().max(500).default('') });
const costCenterSchema = z.object({ name: z.string().min(2).max(120), description: z.string().max(300).default('') });
const cashOpenSchema = z.object({ openingAmount: money.default(0), notes: z.string().max(300).default('') });
const cashCloseSchema = z.object({ closingAmount: money, notes: z.string().max(300).default('') });
const receivablePayableSchema = z.object({ type: z.enum(['RECEIVABLE', 'PAYABLE']), description: z.string().min(2).max(200), category: z.string().max(100).default(''), amount: positiveMoney, dueDate: z.coerce.date(), paymentMethod: z.string().max(60).optional(), costCenterId: objectId.optional() });
const reconciliationSchema = z.object({ provider: z.string().min(2).max(80), periodStart: z.coerce.date(), periodEnd: z.coerce.date(), expected: money, settled: money, details: z.any().optional() });
const fiscalSchema = z.object({ saleId: objectId.optional(), externalId: z.string().max(120).optional(), number: z.string().max(80).default(''), status: z.enum(['PENDING', 'ISSUED', 'CANCELED', 'ERROR']).default('PENDING'), amount: positiveMoney, provider: z.string().max(80).default(''), issuedAt: optionalDate, payload: z.any().optional() });

/** Marcos 25–34: suite de expansão comercial, sempre isolada por salonId. */
export async function operationsSuiteRoutes(app: FastifyInstance) {
  app.get('/admin/expansion/summary', async (request) => {
    const salonId = tenantId(request);
    const [sales, packageOffers, suppliers, timeEntries, clinicalRecords, campaigns, portalLinks, organizations, resources, openFinancial] = await Promise.all([
      prisma.sale.count({ where: { salonId } }), prisma.packageOffer.count({ where: { salonId, active: true } }),
      prisma.supplier.count({ where: { salonId, active: true } }), prisma.timeClockEntry.count({ where: { salonId } }),
      prisma.clinicalRecord.count({ where: { salonId } }), prisma.marketingCampaign.count({ where: { salonId } }),
      prisma.clientPortalAccess.count({ where: { salonId } }), prisma.organization.count({ where: { salonId, status: 'ACTIVE' } }),
      prisma.businessResource.count({ where: { salonId, active: true } }), prisma.receivablePayable.count({ where: { salonId, status: 'OPEN' } })
    ]);
    return { sales, packageOffers, suppliers, timeEntries, clinicalRecords, campaigns, portalLinks, organizations, resources, openFinancial };
  });

  app.get('/admin/pos/sales', async (request) => {
    const salonId = tenantId(request);
    return prisma.sale.findMany({ where: { salonId }, include: { items: true, payments: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  });

  app.post('/admin/pos/sales', async (request, reply) => {
    const salonId = tenantId(request);
    const data = createSaleSchema.parse(request.body);
    const totals = calculateSaleTotals(data.items, data.discount);
    const paid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paid + 0.001 < totals.total) throw badRequest('Pagamentos informados não cobrem o total da venda.');
    const productItems = data.items.filter((item) => item.kind === 'PRODUCT' && item.inventoryProductId);
    for (const item of productItems) {
      const product = await prisma.inventoryProduct.findFirst({ where: { id: item.inventoryProductId, salonId, active: true } });
      if (!product) throw badRequest(`Produto de estoque não encontrado para ${item.description}.`);
      if (product.quantity < item.quantity) throw badRequest(`Estoque insuficiente para ${item.description}.`);
    }
    const created = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          number: saleNumber(), clientId: data.clientId, appointmentId: data.appointmentId, subtotal: totals.subtotal,
          discount: totals.discount, total: totals.total, status: 'PAID', notes: data.notes, salonId, closedAt: new Date(),
          items: { create: data.items.map((item) => ({ kind: item.kind, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: Number((item.quantity * item.unitPrice).toFixed(2)), serviceId: item.serviceId, inventoryProductId: item.inventoryProductId, professionalId: item.professionalId, salonId })) },
          payments: { create: data.payments.map((payment) => ({ method: payment.method, amount: payment.amount, status: 'CAPTURED', externalReference: payment.externalReference, salonId })) }
        },
        include: { items: true, payments: true }
      });
      for (const item of productItems) {
        await tx.inventoryProduct.update({ where: { id: item.inventoryProductId! }, data: { quantity: { decrement: item.quantity } } });
        await tx.inventoryMovement.create({ data: { type: 'OUT', quantity: item.quantity, reason: `Venda ${sale.number}`, productId: item.inventoryProductId!, salonId } });
      }
      await tx.financialEntry.create({ data: { type: 'REVENUE', category: 'PDV', description: `Venda ${sale.number}`, amount: totals.total, paymentMethod: data.payments.length === 1 ? data.payments[0].method : 'MULTIPLE', referenceDate: new Date(), paid: true, salonId } });
      return sale;
    });
    return reply.status(201).send(created);
  });

  app.post('/admin/pos/sales/:id/refund', async (request) => {
    requireAdmin(request); const salonId = tenantId(request); const params = z.object({ id: objectId }).parse(request.params);
    const sale = await prisma.sale.findFirst({ where: { id: params.id, salonId }, include: { items: true } });
    if (!sale) throw badRequest('Venda não encontrada.');
    if (sale.status === 'REFUNDED') throw badRequest('Venda já estornada.');
    return prisma.$transaction(async (tx) => {
      for (const item of sale.items.filter((entry) => entry.kind === 'PRODUCT' && entry.inventoryProductId)) {
        await tx.inventoryProduct.update({ where: { id: item.inventoryProductId! }, data: { quantity: { increment: item.quantity } } });
        await tx.inventoryMovement.create({ data: { type: 'IN', quantity: item.quantity, reason: `Estorno ${sale.number}`, productId: item.inventoryProductId!, salonId } });
      }
      await tx.financialEntry.create({ data: { type: 'EXPENSE', category: 'REFUND', description: `Estorno ${sale.number}`, amount: sale.total, paymentMethod: 'REFUND', referenceDate: new Date(), paid: true, salonId } });
      return tx.sale.update({ where: { id: sale.id }, data: { status: 'REFUNDED' } });
    });
  });

  app.get('/admin/customer-plans', async (request) => {
    const salonId = tenantId(request);
    const [packages, clientPackages, plans, memberships, giftCards] = await Promise.all([
      prisma.packageOffer.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' } }), prisma.clientPackage.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.membershipPlan.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' } }), prisma.clientMembership.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.giftCard.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 })
    ]);
    return { packages, clientPackages, plans, memberships, giftCards };
  });
  app.post('/admin/customer-plans/packages', async (request, reply) => { const salonId = tenantId(request); const data = packageOfferSchema.parse(request.body); return reply.status(201).send(await prisma.packageOffer.create({ data: { ...data, salonId } })); });
  app.post('/admin/customer-plans/packages/assign', async (request, reply) => {
    const salonId = tenantId(request); const data = clientPackageSchema.parse(request.body);
    const offer = await prisma.packageOffer.findFirst({ where: { id: data.packageOfferId, salonId, active: true } });
    const client = await prisma.client.findFirst({ where: { id: data.clientId, salonId } });
    if (!offer || !client) throw badRequest('Cliente ou pacote não encontrado.');
    const expiresAt = new Date(Date.now() + offer.validityDays * 86400000);
    return reply.status(201).send(await prisma.clientPackage.create({ data: { clientId: data.clientId, packageOfferId: offer.id, remainingCredits: offer.totalCredits, expiresAt, salonId } }));
  });
  app.post('/admin/customer-plans/memberships', async (request, reply) => { const salonId = tenantId(request); const data = membershipPlanSchema.parse(request.body); return reply.status(201).send(await prisma.membershipPlan.create({ data: { ...data, salonId } })); });
  app.post('/admin/customer-plans/memberships/assign', async (request, reply) => {
    const salonId = tenantId(request); const data = clientMembershipSchema.parse(request.body);
    const [plan, client] = await Promise.all([prisma.membershipPlan.findFirst({ where: { id: data.planId, salonId, active: true } }), prisma.client.findFirst({ where: { id: data.clientId, salonId } })]);
    if (!plan || !client) throw badRequest('Cliente ou plano de assinatura não encontrado.');
    return reply.status(201).send(await prisma.clientMembership.create({ data: { clientId: data.clientId, planId: data.planId, nextBillingAt: toNullableDate(data.nextBillingAt), salonId } }));
  });
  app.post('/admin/customer-plans/gift-cards', async (request, reply) => {
    const salonId = tenantId(request); const data = giftCardSchema.parse(request.body);
    return reply.status(201).send(await prisma.giftCard.create({ data: { code: giftCardCode(), clientId: data.clientId, purchaserName: data.purchaserName, recipientName: data.recipientName, initialBalance: data.amount, balance: data.amount, expiresAt: toNullableDate(data.expiresAt), salonId } }));
  });

  app.get('/admin/procurement', async (request) => { const salonId = tenantId(request); const [suppliers, purchaseOrders] = await Promise.all([prisma.supplier.findMany({ where: { salonId }, orderBy: { name: 'asc' } }), prisma.purchaseOrder.findMany({ where: { salonId }, orderBy: { orderedAt: 'desc' }, take: 200 })]); return { suppliers, purchaseOrders }; });
  app.post('/admin/procurement/suppliers', async (request, reply) => { const salonId = tenantId(request); const data = supplierSchema.parse(request.body); return reply.status(201).send(await prisma.supplier.create({ data: { ...data, salonId } })); });
  app.post('/admin/procurement/orders', async (request, reply) => {
    const salonId = tenantId(request); const data = purchaseOrderSchema.parse(request.body);
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, salonId, active: true } }); if (!supplier) throw badRequest('Fornecedor não encontrado.');
    for (const item of data.items) { const product = await prisma.inventoryProduct.findFirst({ where: { id: item.productId, salonId, active: true } }); if (!product) throw badRequest(`Produto não encontrado: ${item.description}.`); }
    return reply.status(201).send(await prisma.purchaseOrder.create({ data: { supplierId: data.supplierId, number: purchaseNumber(), items: data.items, total: calculatePurchaseTotal(data.items), expectedAt: toNullableDate(data.expectedAt), notes: data.notes, salonId } }));
  });
  app.post('/admin/procurement/orders/:id/receive', async (request) => {
    requireAdmin(request); const salonId = tenantId(request); const params = z.object({ id: objectId }).parse(request.params);
    const order = await prisma.purchaseOrder.findFirst({ where: { id: params.id, salonId } }); if (!order) throw badRequest('Pedido de compra não encontrado.'); if (order.status === 'RECEIVED') throw badRequest('Pedido já recebido.');
    const items = purchaseItemSchema.array().parse(order.items);
    return prisma.$transaction(async (tx) => { for (const item of items) { const product = await tx.inventoryProduct.findFirst({ where: { id: item.productId, salonId, active: true } }); if (!product) throw badRequest(`Produto não encontrado no recebimento: ${item.description}.`); await tx.inventoryProduct.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity }, costPrice: item.unitCost } }); await tx.inventoryMovement.create({ data: { type: 'IN', quantity: item.quantity, reason: `Recebimento ${order.number}`, productId: item.productId, salonId } }); } return tx.purchaseOrder.update({ where: { id: order.id }, data: { status: 'RECEIVED', receivedAt: new Date() } }); });
  });

  app.get('/admin/team-management', async (request) => { const salonId = tenantId(request); const [timeEntries, goals, payrollRuns] = await Promise.all([prisma.timeClockEntry.findMany({ where: { salonId }, orderBy: { occurredAt: 'desc' }, take: 300 }), prisma.staffGoal.findMany({ where: { salonId }, orderBy: { periodStart: 'desc' }, take: 200 }), prisma.payrollRun.findMany({ where: { salonId }, orderBy: { periodStart: 'desc' }, take: 60 })]); return { timeEntries, goals, payrollRuns }; });
  app.post('/admin/team-management/time-clock', async (request, reply) => { const salonId = tenantId(request); const data = timeClockSchema.parse(request.body); const professional = await prisma.professional.findFirst({ where: { id: data.professionalId, salonId, active: true } }); if (!professional) throw badRequest('Profissional não encontrado.'); return reply.status(201).send(await prisma.timeClockEntry.create({ data: { professionalId: data.professionalId, type: data.type, occurredAt: toNullableDate(data.occurredAt) || new Date(), notes: data.notes, salonId } })); });
  app.post('/admin/team-management/goals', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = staffGoalSchema.parse(request.body); if (data.periodEnd <= data.periodStart) throw badRequest('Fim da meta deve ser posterior ao início.'); return reply.status(201).send(await prisma.staffGoal.create({ data: { ...data, salonId } })); });
  app.post('/admin/team-management/payroll', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = payrollSchema.parse(request.body); const normalizedEntries = data.entries.map((entry) => ({ ...entry, total: Number(Math.max(entry.baseAmount + entry.commissionAmount + entry.bonusAmount - entry.deductions, 0).toFixed(2)) })); const grossTotal = Number(normalizedEntries.reduce((sum, entry) => sum + entry.total, 0).toFixed(2)); return reply.status(201).send(await prisma.payrollRun.create({ data: { periodStart: data.periodStart, periodEnd: data.periodEnd, entries: normalizedEntries, grossTotal, notes: data.notes, salonId } })); });

  app.get('/admin/clinical-records', async (request) => { requireAdmin(request); const salonId = tenantId(request); const query = z.object({ clientId: objectId.optional() }).parse(request.query); return prisma.clinicalRecord.findMany({ where: { salonId, ...(query.clientId ? { clientId: query.clientId } : {}) }, orderBy: { createdAt: 'desc' }, take: 300 }); });
  app.post('/admin/clinical-records', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = clinicalRecordSchema.parse(request.body); const client = await prisma.client.findFirst({ where: { id: data.clientId, salonId } }); if (!client) throw badRequest('Cliente não encontrado.'); return reply.status(201).send(await prisma.clinicalRecord.create({ data: { clientId: data.clientId, appointmentId: data.appointmentId, recordType: data.recordType, answers: data.answers, allergies: data.allergies, notes: data.notes, photoUrls: data.photoUrls, signedBy: data.signedBy, signedAt: toNullableDate(data.signedAt), consentText: data.consentText, salonId } })); });

  app.get('/admin/marketing', async (request) => { const salonId = tenantId(request); const [campaigns, reviews, coupons] = await Promise.all([prisma.marketingCampaign.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 }), prisma.reviewRequest.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 }), prisma.coupon.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 })]); return { campaigns, reviews, coupons }; });
  app.post('/admin/marketing/campaigns', async (request, reply) => { const salonId = tenantId(request); const data = campaignSchema.parse(request.body); return reply.status(201).send(await prisma.marketingCampaign.create({ data: { name: data.name, channel: data.channel, segment: data.segment, message: data.message, status: data.status, scheduledAt: toNullableDate(data.scheduledAt), salonId } })); });
  app.post('/admin/marketing/reviews', async (request, reply) => { const salonId = tenantId(request); const data = reviewSchema.parse(request.body); const client = await prisma.client.findFirst({ where: { id: data.clientId, salonId } }); if (!client) throw badRequest('Cliente não encontrado.'); return reply.status(201).send(await prisma.reviewRequest.create({ data: { ...data, salonId } })); });
  app.post('/admin/marketing/coupons', async (request, reply) => { const salonId = tenantId(request); const data = couponSchema.parse(request.body); const duplicate = await prisma.coupon.findFirst({ where: { salonId, code: data.code } }); if (duplicate) throw badRequest('Já existe um cupom com esse código neste salão.'); return reply.status(201).send(await prisma.coupon.create({ data: { ...data, startsAt: toNullableDate(data.startsAt), expiresAt: toNullableDate(data.expiresAt), salonId } })); });

  app.get('/admin/client-portal/access', async (request) => { const salonId = tenantId(request); return prisma.clientPortalAccess.findMany({ where: { salonId }, select: { id: true, clientId: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200 }); });
  app.post('/admin/client-portal/access', async (request, reply) => { const salonId = tenantId(request); const data = portalAccessSchema.parse(request.body); const client = await prisma.client.findFirst({ where: { id: data.clientId, salonId } }); if (!client) throw badRequest('Cliente não encontrado.'); const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + data.expiresInHours * 3600000); await prisma.clientPortalAccess.create({ data: { tokenHash: tokenHash(token), clientId: data.clientId, expiresAt, revokedAt: null, salonId } }); const appUrl = String(process.env.FRONTEND_URL || process.env.WEB_URL || '').replace(/\/+$/, ''); return reply.status(201).send({ token, expiresAt, url: appUrl ? `${appUrl}/?action=client-portal&token=${encodeURIComponent(token)}` : `?action=client-portal&token=${encodeURIComponent(token)}` }); });
  app.post('/admin/client-portal/access/:id/revoke', async (request) => { const salonId = tenantId(request); const params = z.object({ id: objectId }).parse(request.params); const link = await prisma.clientPortalAccess.findFirst({ where: { id: params.id, salonId } }); if (!link) throw badRequest('Acesso do portal não encontrado.'); return prisma.clientPortalAccess.update({ where: { id: link.id }, data: { revokedAt: new Date() } }); });

  app.get('/admin/organizations', async (request) => { requireAdmin(request); const salonId = tenantId(request); const [organizations, locations] = await Promise.all([prisma.organization.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' } }), prisma.organizationLocation.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' } })]); return { organizations, locations }; });
  app.post('/admin/organizations', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = organizationSchema.parse(request.body); return reply.status(201).send(await prisma.organization.create({ data: { ...data, salonId } })); });
  app.post('/admin/organizations/locations', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = locationSchema.parse(request.body); const organization = await prisma.organization.findFirst({ where: { id: data.organizationId, salonId } }); const locationSalon = await prisma.salon.findUnique({ where: { id: data.locationSalonId } }); if (!organization || !locationSalon) throw badRequest('Organização ou unidade não encontrada.'); return reply.status(201).send(await prisma.organizationLocation.create({ data: { organizationId: data.organizationId, locationSalonId: data.locationSalonId, label: data.label, salonId } })); });

  app.get('/admin/resources', async (request) => { const salonId = tenantId(request); const [resources, reservations] = await Promise.all([prisma.businessResource.findMany({ where: { salonId }, orderBy: { name: 'asc' } }), prisma.resourceReservation.findMany({ where: { salonId }, orderBy: { startTime: 'desc' }, take: 300 })]); return { resources, reservations }; });
  app.post('/admin/resources', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = resourceSchema.parse(request.body); return reply.status(201).send(await prisma.businessResource.create({ data: { ...data, salonId } })); });
  app.post('/admin/resources/reservations', async (request, reply) => { const salonId = tenantId(request); const data = reservationSchema.parse(request.body); if (data.endTime <= data.startTime) throw badRequest('Fim da reserva deve ser posterior ao início.'); const resource = await prisma.businessResource.findFirst({ where: { id: data.resourceId, salonId, active: true } }); if (!resource) throw badRequest('Recurso não encontrado.'); const conflicts = await prisma.resourceReservation.count({ where: { resourceId: data.resourceId, salonId, status: 'RESERVED', startTime: { lt: data.endTime }, endTime: { gt: data.startTime } } }); if (conflicts >= resource.capacity) throw badRequest('Capacidade do recurso esgotada para este horário.'); return reply.status(201).send(await prisma.resourceReservation.create({ data: { ...data, salonId } })); });

  app.get('/admin/finance-advanced', async (request) => { requireAdmin(request); const salonId = tenantId(request); const [costCenters, cashSessions, ledger, reconciliations, fiscalDocuments] = await Promise.all([prisma.costCenter.findMany({ where: { salonId }, orderBy: { name: 'asc' } }), prisma.cashSession.findMany({ where: { salonId }, orderBy: { openedAt: 'desc' }, take: 100 }), prisma.receivablePayable.findMany({ where: { salonId }, orderBy: { dueDate: 'asc' }, take: 400 }), prisma.financialReconciliation.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 100 }), prisma.fiscalDocument.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 200 })]); return { costCenters, cashSessions, ledger, reconciliations, fiscalDocuments }; });
  app.post('/admin/finance-advanced/cost-centers', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = costCenterSchema.parse(request.body); return reply.status(201).send(await prisma.costCenter.create({ data: { ...data, salonId } })); });
  app.post('/admin/finance-advanced/cash/open', async (request, reply) => { const tenant = requireAdmin(request); const salonId = tenant.salonId; const data = cashOpenSchema.parse(request.body); const alreadyOpen = await prisma.cashSession.findFirst({ where: { salonId, status: 'OPEN' } }); if (alreadyOpen) throw badRequest('Já existe um caixa aberto.'); return reply.status(201).send(await prisma.cashSession.create({ data: { openedBy: tenant.id, openingAmount: data.openingAmount, notes: data.notes, salonId } })); });
  app.post('/admin/finance-advanced/cash/:id/close', async (request) => { requireAdmin(request); const salonId = tenantId(request); const params = z.object({ id: objectId }).parse(request.params); const data = cashCloseSchema.parse(request.body); const cash = await prisma.cashSession.findFirst({ where: { id: params.id, salonId, status: 'OPEN' } }); if (!cash) throw badRequest('Caixa aberto não encontrado.'); return prisma.cashSession.update({ where: { id: cash.id }, data: { status: 'CLOSED', closedAt: new Date(), closingAmount: data.closingAmount, notes: data.notes || cash.notes } }); });
  app.post('/admin/finance-advanced/ledger', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = receivablePayableSchema.parse(request.body); return reply.status(201).send(await prisma.receivablePayable.create({ data: { ...data, salonId } })); });
  app.post('/admin/finance-advanced/ledger/:id/settle', async (request) => { requireAdmin(request); const salonId = tenantId(request); const params = z.object({ id: objectId }).parse(request.params); const entry = await prisma.receivablePayable.findFirst({ where: { id: params.id, salonId, status: 'OPEN' } }); if (!entry) throw badRequest('Título financeiro aberto não encontrado.'); return prisma.$transaction(async (tx) => { await tx.financialEntry.create({ data: { type: entry.type === 'RECEIVABLE' ? 'REVENUE' : 'EXPENSE', category: entry.category || 'FINANCE_ADV', description: entry.description, amount: entry.amount, paymentMethod: entry.paymentMethod, referenceDate: new Date(), paid: true, salonId } }); return tx.receivablePayable.update({ where: { id: entry.id }, data: { status: 'SETTLED', settledAt: new Date() } }); }); });
  app.post('/admin/finance-advanced/reconciliations', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = reconciliationSchema.parse(request.body); const difference = calculateReconciliation(data.expected, data.settled); return reply.status(201).send(await prisma.financialReconciliation.create({ data: { ...data, difference, status: Math.abs(difference) < 0.01 ? 'MATCHED' : 'REVIEW', salonId } })); });
  app.post('/admin/finance-advanced/fiscal-documents', async (request, reply) => { requireAdmin(request); const salonId = tenantId(request); const data = fiscalSchema.parse(request.body); return reply.status(201).send(await prisma.fiscalDocument.create({ data: { ...data, issuedAt: toNullableDate(data.issuedAt), salonId } })); });
}

/** Portal público somente leitura, validado por token aleatório armazenado como SHA-256. */
export async function clientPortalPublicRoutes(app: FastifyInstance) {
  app.get('/client-portal/:token/overview', async (request) => {
    const params = z.object({ token: z.string().min(20).max(200) }).parse(request.params);
    const hash = tokenHash(params.token);
    const access = await prisma.clientPortalAccess.findUnique({ where: { tokenHash: hash } });
    if (!access || access.revokedAt || access.expiresAt <= new Date()) throw forbidden('Link do portal inválido ou expirado.');
    const client = await prisma.client.findFirst({ where: { id: access.clientId, salonId: access.salonId } });
    if (!client) throw forbidden('Cliente do portal não encontrado.');
    const [appointments, packages, memberships, giftCards, loyaltyEntries, salon] = await Promise.all([
      prisma.appointment.findMany({ where: { salonId: access.salonId, clientId: access.clientId }, include: { service: true, professional: true }, orderBy: { startTime: 'desc' }, take: 50 }),
      prisma.clientPackage.findMany({ where: { salonId: access.salonId, clientId: access.clientId }, orderBy: { createdAt: 'desc' } }),
      prisma.clientMembership.findMany({ where: { salonId: access.salonId, clientId: access.clientId }, orderBy: { createdAt: 'desc' } }),
      prisma.giftCard.findMany({ where: { salonId: access.salonId, clientId: access.clientId }, orderBy: { createdAt: 'desc' } }),
      prisma.loyaltyEntry.findMany({ where: { salonId: access.salonId, clientId: access.clientId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.salon.findUnique({ where: { id: access.salonId }, select: { name: true, logoUrl: true, primaryColor: true } })
    ]);
    await prisma.clientPortalAccess.update({ where: { id: access.id }, data: { lastUsedAt: new Date() } });
    return { salon, client: { id: client.id, name: client.name, phone: client.phone, email: client.email }, appointments, packages, memberships, giftCards, loyaltyEntries };
  });
}
