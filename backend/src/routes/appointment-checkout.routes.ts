import { randomBytes } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { hasSalonModule, MODULE_LABELS, SalonModule } from '../services/module-access.service';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
const positiveInt = z.coerce.number().int().positive();
const positiveMoney = z.coerce.number().finite().positive();

const appointmentParamsSchema = z.object({ id: objectId }).strict();
const resourceReservationSchema = z.object({
  resourceId: objectId,
  notes: z.string().trim().max(500).default('')
}).strict();
const checkoutSchema = z.object({
  packageId: objectId.optional(),
  products: z.array(z.object({ inventoryProductId: objectId, quantity: positiveInt }).strict()).max(50).default([]),
  payments: z.array(z.object({
    method: z.string().trim().min(2).max(40),
    amount: positiveMoney,
    externalReference: z.string().trim().max(120).optional()
  }).strict()).max(8).default([]),
  notes: z.string().trim().max(500).default('')
}).strict();

type RequiredModule = Extract<SalonModule, 'AGENDA' | 'POS' | 'PACOTES' | 'RECURSOS'>;

type Finding = {
  severity: 'ERROR' | 'WARN';
  domain: string;
  reference: string;
  message: string;
};

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function saleNumber() {
  return `VEN-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

async function requireModules(request: FastifyRequest, modules: RequiredModule[]) {
  const tenant = getTenant(request);
  const salon = await prisma.salon.findUnique({
    where: { id: tenant.salonId },
    select: { modulesConfigured: true, enabledModules: true }
  });
  if (!salon) throw httpError(404, 'Salão da sessão não encontrado.');
  const missing = modules.filter((module) => !hasSalonModule(salon, module));
  if (missing.length) {
    throw httpError(403, `Integração indisponível: habilite ${missing.map((module) => MODULE_LABELS[module]).join(', ')}.`);
  }
  return { tenant, salon };
}

async function getAppointment(salonId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, salonId },
    include: { service: true, professional: true }
  });
  if (!appointment) throw httpError(404, 'Agendamento não encontrado neste salão.');
  return appointment;
}

function appointmentCanCheckout(status: string) {
  return status !== 'CANCELED' && status !== 'NO_SHOW';
}

/**
 * Marco 35 — Etapa 5.
 * Integração explícita Agenda → Recursos → Pacotes → PDV → Financeiro.
 * Nenhum preço de serviço/produto é aceito do browser: os valores são lidos do tenant.
 */
export async function appointmentCheckoutRoutes(app: FastifyInstance) {
  app.get('/admin/pos/appointments/:id/checkout-preview', async (request) => {
    const { tenant, salon } = await requireModules(request, ['AGENDA', 'POS']);
    const { id } = appointmentParamsSchema.parse(request.params);
    const appointment = await getAppointment(tenant.salonId, id);
    const now = new Date();

    const existingSale = await prisma.sale.findFirst({
      where: { salonId: tenant.salonId, appointmentId: appointment.id, status: { not: 'REFUNDED' } },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });

    const packageModuleEnabled = hasSalonModule(salon, 'PACOTES');
    const resourceModuleEnabled = hasSalonModule(salon, 'RECURSOS');

    let eligiblePackages: Array<{
      id: string;
      packageOfferId: string;
      name: string;
      remainingCredits: number;
      expiresAt: Date;
    }> = [];

    if (packageModuleEnabled && appointment.clientId) {
      const clientPackages = await prisma.clientPackage.findMany({
        where: {
          salonId: tenant.salonId,
          clientId: appointment.clientId,
          status: 'ACTIVE',
          remainingCredits: { gt: 0 },
          expiresAt: { gt: now }
        },
        orderBy: { expiresAt: 'asc' }
      });
      const offerIds = [...new Set(clientPackages.map((item) => item.packageOfferId))];
      const offers = offerIds.length
        ? await prisma.packageOffer.findMany({ where: { salonId: tenant.salonId, id: { in: offerIds }, active: true } })
        : [];
      const offerById = new Map(offers.map((offer) => [offer.id, offer]));
      eligiblePackages = clientPackages.flatMap((item) => {
        const offer = offerById.get(item.packageOfferId);
        if (!offer) return [];
        const coversService = offer.serviceIds.length === 0 || offer.serviceIds.includes(appointment.serviceId);
        return coversService ? [{
          id: item.id,
          packageOfferId: offer.id,
          name: offer.name,
          remainingCredits: item.remainingCredits,
          expiresAt: item.expiresAt
        }] : [];
      });
    }

    let resourceReservations: Array<{
      id: string;
      resourceId: string;
      resourceName: string;
      status: string;
      startTime: Date;
      endTime: Date;
    }> = [];
    let availableResources: Array<{ id: string; name: string; type: string; capacity: number; available: boolean }> = [];

    if (resourceModuleEnabled) {
      const reservations = await prisma.resourceReservation.findMany({
        where: { salonId: tenant.salonId, appointmentId: appointment.id },
        orderBy: { createdAt: 'asc' }
      });
      const resources = await prisma.businessResource.findMany({
        where: { salonId: tenant.salonId, active: true },
        orderBy: { name: 'asc' }
      });
      const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
      resourceReservations = reservations.map((reservation) => ({
        id: reservation.id,
        resourceId: reservation.resourceId,
        resourceName: resourceById.get(reservation.resourceId)?.name || 'Recurso indisponível',
        status: reservation.status,
        startTime: reservation.startTime,
        endTime: reservation.endTime
      }));
      availableResources = await Promise.all(resources.map(async (resource) => {
        const conflicts = await prisma.resourceReservation.count({
          where: {
            salonId: tenant.salonId,
            resourceId: resource.id,
            status: 'RESERVED',
            appointmentId: { not: appointment.id },
            startTime: { lt: appointment.endTime },
            endTime: { gt: appointment.startTime }
          }
        });
        return { id: resource.id, name: resource.name, type: resource.type, capacity: resource.capacity, available: conflicts < resource.capacity };
      }));
    }

    return {
      appointment: {
        id: appointment.id,
        clientId: appointment.clientId,
        clientName: appointment.clientName,
        status: appointment.status,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        service: { id: appointment.service.id, name: appointment.service.name, price: appointment.service.price },
        professional: { id: appointment.professional.id, name: appointment.professional.name }
      },
      existingSale,
      eligiblePackages,
      resourceReservations,
      availableResources,
      modules: { packages: packageModuleEnabled, resources: resourceModuleEnabled },
      readyForCheckout: appointmentCanCheckout(appointment.status) && !existingSale
    };
  });

  app.post('/admin/pos/appointments/:id/resource-reservations', async (request, reply) => {
    const { tenant } = await requireModules(request, ['AGENDA', 'POS', 'RECURSOS']);
    const { id } = appointmentParamsSchema.parse(request.params);
    const data = resourceReservationSchema.parse(request.body);
    const appointment = await getAppointment(tenant.salonId, id);
    if (!appointmentCanCheckout(appointment.status)) throw httpError(409, 'Atendimento cancelado ou no-show não pode reservar recurso.');

    const resource = await prisma.businessResource.findFirst({
      where: { id: data.resourceId, salonId: tenant.salonId, active: true }
    });
    if (!resource) throw httpError(404, 'Recurso não encontrado neste salão.');

    const existing = await prisma.resourceReservation.findFirst({
      where: { salonId: tenant.salonId, appointmentId: appointment.id, resourceId: resource.id, status: 'RESERVED' }
    });
    if (existing) return reply.status(200).send(existing);

    const conflicts = await prisma.resourceReservation.count({
      where: {
        salonId: tenant.salonId,
        resourceId: resource.id,
        status: 'RESERVED',
        startTime: { lt: appointment.endTime },
        endTime: { gt: appointment.startTime }
      }
    });
    if (conflicts >= resource.capacity) throw httpError(409, 'Capacidade do recurso esgotada para o horário do atendimento.');

    const reservation = await prisma.resourceReservation.create({
      data: {
        resourceId: resource.id,
        appointmentId: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: 'RESERVED',
        notes: data.notes,
        salonId: tenant.salonId
      }
    });
    return reply.status(201).send(reservation);
  });

  app.post('/admin/pos/appointments/:id/checkout', async (request, reply) => {
    const { tenant } = await requireModules(request, ['AGENDA', 'POS']);
    const { id } = appointmentParamsSchema.parse(request.params);
    const data = checkoutSchema.parse(request.body);
    if (data.packageId) await requireModules(request, ['PACOTES']);

    const appointment = await getAppointment(tenant.salonId, id);
    if (!appointmentCanCheckout(appointment.status)) throw httpError(409, 'Atendimento cancelado ou no-show não pode ser finalizado no PDV.');

    const previousSale = await prisma.sale.findFirst({
      where: { salonId: tenant.salonId, appointmentId: appointment.id, status: { not: 'REFUNDED' } },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    if (previousSale) {
      return reply.status(200).send({ sale: previousSale, idempotent: true, message: 'Atendimento já possui checkout concluído.' });
    }

    let selectedPackage: Awaited<ReturnType<typeof prisma.clientPackage.findFirst>> = null;
    let selectedOffer: Awaited<ReturnType<typeof prisma.packageOffer.findFirst>> = null;
    if (data.packageId) {
      if (!appointment.clientId) throw httpError(409, 'Agendamento sem cliente vinculado não pode consumir pacote.');
      selectedPackage = await prisma.clientPackage.findFirst({
        where: {
          id: data.packageId,
          salonId: tenant.salonId,
          clientId: appointment.clientId,
          status: 'ACTIVE',
          remainingCredits: { gt: 0 },
          expiresAt: { gt: new Date() }
        }
      });
      if (!selectedPackage) throw httpError(409, 'Pacote selecionado está vencido, esgotado ou não pertence ao cliente.');
      selectedOffer = await prisma.packageOffer.findFirst({
        where: { id: selectedPackage.packageOfferId, salonId: tenant.salonId, active: true }
      });
      if (!selectedOffer) throw httpError(409, 'Oferta do pacote não está mais disponível.');
      if (selectedOffer.serviceIds.length > 0 && !selectedOffer.serviceIds.includes(appointment.serviceId)) {
        throw httpError(409, 'O pacote selecionado não cobre o serviço deste atendimento.');
      }
    }

    const productLines: Array<{
      inventoryProductId: string;
      description: string;
      quantity: number;
      unitPrice: number;
    }> = [];
    for (const requested of data.products) {
      const product = await prisma.inventoryProduct.findFirst({
        where: { id: requested.inventoryProductId, salonId: tenant.salonId, active: true }
      });
      if (!product || product.salePrice == null || product.salePrice <= 0) throw httpError(409, 'Produto indisponível para venda neste salão.');
      if (product.quantity < requested.quantity) throw httpError(409, `Estoque insuficiente para ${product.name}.`);
      productLines.push({
        inventoryProductId: product.id,
        description: product.name,
        quantity: requested.quantity,
        unitPrice: product.salePrice
      });
    }

    const servicePrice = selectedPackage ? 0 : appointment.service.price;
    const productTotal = productLines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = Number((servicePrice + productTotal).toFixed(2));
    const paid = Number(data.payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
    if (Math.abs(total - paid) > 0.01) {
      throw httpError(409, `Pagamento divergente: total R$ ${total.toFixed(2)} e pagamentos R$ ${paid.toFixed(2)}.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const number = saleNumber();
      const sale = await tx.sale.create({
        data: {
          number,
          clientId: appointment.clientId,
          appointmentId: appointment.id,
          subtotal: total,
          discount: 0,
          total,
          status: 'PAID',
          notes: data.notes || (selectedOffer ? `Serviço coberto por pacote ${selectedOffer.name}.` : ''),
          salonId: tenant.salonId,
          closedAt: new Date(),
          items: {
            create: [
              {
                kind: 'SERVICE',
                description: selectedOffer ? `${appointment.service.name} • crédito ${selectedOffer.name}` : appointment.service.name,
                quantity: 1,
                unitPrice: servicePrice,
                total: servicePrice,
                serviceId: appointment.serviceId,
                professionalId: appointment.professionalId,
                salonId: tenant.salonId
              },
              ...productLines.map((item) => ({
                kind: 'PRODUCT',
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: Number((item.quantity * item.unitPrice).toFixed(2)),
                inventoryProductId: item.inventoryProductId,
                salonId: tenant.salonId
              }))
            ]
          },
          payments: {
            create: data.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              status: 'CAPTURED',
              externalReference: payment.externalReference,
              salonId: tenant.salonId
            }))
          }
        },
        include: { items: true, payments: true }
      });

      for (const item of productLines) {
        await tx.inventoryProduct.update({
          where: { id: item.inventoryProductId },
          data: { quantity: { decrement: item.quantity } }
        });
        await tx.inventoryMovement.create({
          data: {
            type: 'OUT',
            quantity: item.quantity,
            reason: `Venda ${number} • atendimento ${appointment.id}`,
            productId: item.inventoryProductId,
            salonId: tenant.salonId
          }
        });
      }

      if (selectedPackage) {
        await tx.clientPackage.update({
          where: { id: selectedPackage.id },
          data: {
            remainingCredits: { decrement: 1 },
            ...(selectedPackage.remainingCredits === 1 ? { status: 'EXHAUSTED' } : {})
          }
        });
      }

      if (total > 0) {
        await tx.financialEntry.create({
          data: {
            type: 'REVENUE',
            category: 'PDV',
            description: `Venda ${number}`,
            amount: total,
            paymentMethod: data.payments.length === 1 ? data.payments[0].method : data.payments.length > 1 ? 'MULTIPLE' : 'PACKAGE',
            referenceDate: new Date(),
            paid: true,
            salonId: tenant.salonId
          }
        });
      }

      const completedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'COMPLETED' }
      });
      const releasedResources = await tx.resourceReservation.updateMany({
        where: { salonId: tenant.salonId, appointmentId: appointment.id, status: 'RESERVED' },
        data: { status: 'COMPLETED' }
      });

      return {
        sale,
        appointment: completedAppointment,
        packageConsumption: selectedPackage ? { clientPackageId: selectedPackage.id, creditsConsumed: 1 } : null,
        resourcesCompleted: releasedResources.count
      };
    });

    return reply.status(201).send(result);
  });

  app.get('/admin/homologation/checkout-flow', async (request) => {
    const { tenant } = await requireModules(request, ['AGENDA', 'POS']);
    const [appointments, sales, reservations, packages] = await Promise.all([
      prisma.appointment.findMany({ where: { salonId: tenant.salonId }, select: { id: true, status: true }, take: 1000 }),
      prisma.sale.findMany({ where: { salonId: tenant.salonId }, select: { id: true, number: true, appointmentId: true, status: true }, take: 1000 }),
      prisma.resourceReservation.findMany({ where: { salonId: tenant.salonId }, select: { id: true, appointmentId: true, status: true }, take: 1000 }),
      prisma.clientPackage.findMany({ where: { salonId: tenant.salonId }, select: { id: true, status: true, remainingCredits: true, expiresAt: true }, take: 1000 })
    ]);

    const findings: Finding[] = [];
    const saleByAppointment = new Map(sales.filter((sale) => sale.appointmentId && sale.status !== 'REFUNDED').map((sale) => [sale.appointmentId as string, sale]));
    const appointmentById = new Map(appointments.map((appointment) => [appointment.id, appointment]));

    for (const appointment of appointments.filter((item) => item.status === 'COMPLETED')) {
      if (!saleByAppointment.has(appointment.id)) {
        findings.push({ severity: 'WARN', domain: 'CHECKOUT', reference: appointment.id, message: 'Atendimento COMPLETED ainda não possui venda vinculada.' });
      }
    }
    for (const sale of sales.filter((item) => item.appointmentId && item.status === 'PAID')) {
      const appointment = appointmentById.get(sale.appointmentId as string);
      if (!appointment) findings.push({ severity: 'ERROR', domain: 'CHECKOUT', reference: sale.number, message: 'Venda referencia atendimento inexistente no tenant.' });
      else if (appointment.status !== 'COMPLETED') findings.push({ severity: 'ERROR', domain: 'CHECKOUT', reference: sale.number, message: 'Venda paga vinculada a atendimento que não está COMPLETED.' });
    }
    for (const reservation of reservations.filter((item) => item.appointmentId && item.status === 'RESERVED')) {
      const appointment = appointmentById.get(reservation.appointmentId as string);
      if (appointment?.status === 'COMPLETED' || appointment?.status === 'CANCELED' || appointment?.status === 'NO_SHOW') {
        findings.push({ severity: 'ERROR', domain: 'RESOURCES', reference: reservation.id, message: 'Reserva continua RESERVED após encerramento do atendimento.' });
      }
    }
    const now = new Date();
    for (const clientPackage of packages) {
      if (clientPackage.remainingCredits < 0) findings.push({ severity: 'ERROR', domain: 'PACKAGES', reference: clientPackage.id, message: 'Pacote possui créditos negativos.' });
      if (clientPackage.status === 'ACTIVE' && clientPackage.remainingCredits === 0) findings.push({ severity: 'ERROR', domain: 'PACKAGES', reference: clientPackage.id, message: 'Pacote ACTIVE está sem créditos e deveria estar EXHAUSTED.' });
      if (clientPackage.status === 'ACTIVE' && clientPackage.expiresAt <= now) findings.push({ severity: 'WARN', domain: 'PACKAGES', reference: clientPackage.id, message: 'Pacote vencido permanece ACTIVE.' });
    }

    const errors = findings.filter((item) => item.severity === 'ERROR').length;
    const warnings = findings.filter((item) => item.severity === 'WARN').length;
    return {
      ok: errors === 0,
      checkedAt: new Date().toISOString(),
      scope: { appointments: appointments.length, sales: sales.length, reservations: reservations.length, packages: packages.length },
      summary: { errors, warnings, findings: findings.length },
      findings
    };
  });
}
