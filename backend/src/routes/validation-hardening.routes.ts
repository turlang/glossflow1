import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { getTenant } from './helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
const purchaseItemsSchema = z.array(z.object({
  productId: objectId,
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().finite().positive()
}));

const clockGuardSchema = z.object({
  professionalId: objectId,
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END'])
}).passthrough();

const payrollGuardSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date()
}).passthrough();

const clinicalGuardSchema = z.object({
  clientId: objectId,
  appointmentId: objectId.optional(),
  recordType: z.enum(['ANAMNESIS', 'TREATMENT', 'EVOLUTION', 'CONSENT']).optional().default('ANAMNESIS'),
  consentText: z.string().optional().default(''),
  signedBy: z.string().optional().default(''),
  signedAt: z.union([z.coerce.date(), z.literal(''), z.null()]).optional()
}).passthrough();

const portalGuardSchema = z.object({ clientId: objectId }).passthrough();

type Finding = {
  severity: 'ERROR' | 'WARN';
  domain: 'WHATSAPP' | 'PROCUREMENT' | 'TEAM' | 'CLINICAL' | 'CLIENT_PORTAL';
  reference: string;
  message: string;
};

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function requireAdmin(request: FastifyRequest) {
  const tenant = getTenant(request);
  if (tenant.role !== 'ADMIN') throw httpError(403, 'Esta operação exige o papel ADMIN.');
  return tenant;
}

function validClockTransition(previous: string | undefined, next: string) {
  if (!previous) return next === 'CLOCK_IN';
  if (previous === 'CLOCK_IN') return next === 'BREAK_START' || next === 'CLOCK_OUT';
  if (previous === 'BREAK_START') return next === 'BREAK_END';
  if (previous === 'BREAK_END') return next === 'BREAK_START' || next === 'CLOCK_OUT';
  if (previous === 'CLOCK_OUT') return next === 'CLOCK_IN';
  return false;
}

/**
 * Marco 35 — Etapa 6.
 * Regras preventivas executadas antes das rotas legadas da suite operacional.
 */
export async function enforceMarco35Etapa6BusinessRules(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split('?')[0];
  const tenant = getTenant(request);

  if (path.startsWith('/admin/clinical-records') || path.startsWith('/admin/client-portal/')) {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
  }

  if (request.method === 'POST' && /^\/admin\/procurement\/orders\/[a-f\d]{24}\/receive$/i.test(path)) {
    return reply.status(410).send({
      code: 'SAFE_RECEIPT_REQUIRED',
      message: 'Recebimento legado desativado. Use o fluxo seguro de recebimento para manter estoque e financeiro consistentes.'
    });
  }

  if (request.method === 'POST' && path === '/admin/team-management/time-clock') {
    const parsed = clockGuardSchema.safeParse(request.body);
    if (parsed.success) {
      const latest = await prisma.timeClockEntry.findFirst({
        where: { salonId: tenant.salonId, professionalId: parsed.data.professionalId },
        orderBy: { occurredAt: 'desc' },
        select: { type: true }
      });
      if (!validClockTransition(latest?.type, parsed.data.type)) {
        return reply.status(409).send({
          code: 'INVALID_CLOCK_TRANSITION',
          message: `Transição de ponto inválida: ${latest?.type || 'SEM_REGISTRO'} → ${parsed.data.type}.`
        });
      }
    }
  }

  if (request.method === 'POST' && path === '/admin/team-management/payroll') {
    const parsed = payrollGuardSchema.safeParse(request.body);
    if (parsed.success) {
      if (parsed.data.periodEnd <= parsed.data.periodStart) {
        return reply.status(409).send({ code: 'INVALID_PAYROLL_PERIOD', message: 'O fim da folha deve ser posterior ao início.' });
      }
      const overlap = await prisma.payrollRun.findFirst({
        where: {
          salonId: tenant.salonId,
          periodStart: { lt: parsed.data.periodEnd },
          periodEnd: { gt: parsed.data.periodStart }
        },
        select: { id: true }
      });
      if (overlap) {
        return reply.status(409).send({ code: 'PAYROLL_PERIOD_OVERLAP', message: 'Já existe fechamento de folha sobreposto a este período.' });
      }
    }
  }

  if (request.method === 'POST' && path === '/admin/clinical-records') {
    const parsed = clinicalGuardSchema.safeParse(request.body);
    if (parsed.success) {
      if (parsed.data.appointmentId) {
        const appointment = await prisma.appointment.findFirst({
          where: { id: parsed.data.appointmentId, salonId: tenant.salonId },
          select: { clientId: true }
        });
        if (!appointment) {
          return reply.status(409).send({ code: 'CLINICAL_APPOINTMENT_NOT_FOUND', message: 'Atendimento clínico não pertence a este tenant.' });
        }
        if (appointment.clientId && appointment.clientId !== parsed.data.clientId) {
          return reply.status(409).send({ code: 'CLINICAL_CLIENT_MISMATCH', message: 'Cliente do prontuário diverge do cliente do atendimento.' });
        }
      }
      if (parsed.data.recordType === 'CONSENT') {
        const signedAt = parsed.data.signedAt instanceof Date ? parsed.data.signedAt : null;
        if (!parsed.data.consentText.trim() || !parsed.data.signedBy.trim() || !signedAt) {
          return reply.status(409).send({
            code: 'INCOMPLETE_CLINICAL_CONSENT',
            message: 'Consentimento clínico exige texto, responsável e data/hora da assinatura.'
          });
        }
      }
    }
  }

  if (request.method === 'POST' && path === '/admin/client-portal/access') {
    const parsed = portalGuardSchema.safeParse(request.body);
    if (parsed.success) {
      const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, salonId: tenant.salonId }, select: { id: true } });
      if (client) {
        await prisma.clientPortalAccess.updateMany({
          where: { salonId: tenant.salonId, clientId: client.id, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { revokedAt: new Date() }
        });
      }
    }
  }
}

export async function validationHardeningRoutes(app: FastifyInstance) {
  app.post('/admin/procurement/orders/:id/receive-safe', async (request, reply) => {
    const current = requireAdmin(request);
    const { id } = z.object({ id: objectId }).parse(request.params);
    const order = await prisma.purchaseOrder.findFirst({ where: { id, salonId: current.salonId } });
    if (!order) throw httpError(404, 'Pedido de compra não encontrado.');
    if (order.status === 'RECEIVED') throw httpError(409, 'Pedido já recebido.');

    const items = purchaseItemsSchema.parse(order.items);
    const duplicateMovement = await prisma.inventoryMovement.findFirst({
      where: { salonId: current.salonId, reason: `Recebimento ${order.number}` },
      select: { id: true }
    });
    if (duplicateMovement) throw httpError(409, 'Já existem movimentos de estoque para este pedido; execute o diagnóstico antes de tentar novamente.');

    const result = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.inventoryProduct.findFirst({ where: { id: item.productId, salonId: current.salonId, active: true } });
        if (!product) throw httpError(409, `Produto indisponível no recebimento: ${item.description}.`);
        await tx.inventoryProduct.update({ where: { id: product.id }, data: { quantity: { increment: item.quantity }, costPrice: item.unitCost } });
        await tx.inventoryMovement.create({
          data: { type: 'IN', quantity: item.quantity, reason: `Recebimento ${order.number}`, productId: product.id, salonId: current.salonId }
        });
      }

      let payable = await tx.receivablePayable.findFirst({
        where: { salonId: current.salonId, type: 'PAYABLE', description: { contains: order.number } }
      });
      if (!payable) {
        payable = await tx.receivablePayable.create({
          data: {
            type: 'PAYABLE',
            description: `Compra ${order.number}`,
            category: 'COMPRAS',
            amount: order.total,
            dueDate: order.expectedAt || new Date(),
            status: 'OPEN',
            salonId: current.salonId
          }
        });
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED', receivedAt: new Date() }
      });
      return { order: updatedOrder, payable };
    });

    return reply.status(200).send({ ...result, safeReceipt: true });
  });

  app.get('/admin/homologation/validation-suite', async (request) => {
    const current = requireAdmin(request);
    const salonId = current.salonId;
    const now = new Date();
    const whatsapp = getIntegrationStatus().find((item) => item.key === 'whatsapp');

    const [templates, orders, movements, payables, timeEntries, payrollRuns, clinicalRecords, appointments, portalAccesses] = await Promise.all([
      prisma.whatsAppTemplate.findMany({ where: { salonId, active: true }, select: { id: true, event: true } }),
      prisma.purchaseOrder.findMany({ where: { salonId }, orderBy: { orderedAt: 'desc' }, take: 200 }),
      prisma.inventoryMovement.findMany({ where: { salonId, type: 'IN' }, select: { id: true, reason: true }, take: 1000 }),
      prisma.receivablePayable.findMany({ where: { salonId, type: 'PAYABLE' }, select: { id: true, description: true }, take: 500 }),
      prisma.timeClockEntry.findMany({ where: { salonId }, orderBy: { occurredAt: 'asc' }, take: 1000 }),
      prisma.payrollRun.findMany({ where: { salonId }, orderBy: { periodStart: 'asc' }, take: 300 }),
      prisma.clinicalRecord.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.appointment.findMany({ where: { salonId }, select: { id: true, clientId: true }, take: 1000 }),
      prisma.clientPortalAccess.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 500 })
    ]);

    const findings: Finding[] = [];

    if (!whatsapp || whatsapp.status !== 'connected') {
      findings.push({ severity: 'ERROR', domain: 'WHATSAPP', reference: 'provider', message: `Provider WhatsApp não está totalmente configurado${whatsapp?.missingEnv.length ? `; faltam ${whatsapp.missingEnv.join(', ')}` : ''}.` });
    }
    if (process.env.TWILIO_TRIAL_MODE === 'true') {
      findings.push({ severity: 'WARN', domain: 'WHATSAPP', reference: 'provider', message: 'WhatsApp está conectado via Twilio Trial; sender definitivo ainda precisa de homologação para produção comercial.' });
    }
    if (templates.length === 0) findings.push({ severity: 'WARN', domain: 'WHATSAPP', reference: 'templates', message: 'Nenhum template WhatsApp ativo foi encontrado no tenant.' });

    const movementReasons = new Set(movements.map((item) => item.reason));
    for (const order of orders) {
      if (order.status === 'RECEIVED' && !movementReasons.has(`Recebimento ${order.number}`)) {
        findings.push({ severity: 'ERROR', domain: 'PROCUREMENT', reference: order.number, message: 'Pedido RECEIVED sem movimento de estoque canônico.' });
      }
      if (order.status === 'RECEIVED' && !payables.some((item) => item.description.includes(order.number))) {
        findings.push({ severity: 'ERROR', domain: 'PROCUREMENT', reference: order.number, message: 'Pedido RECEIVED sem conta a pagar correspondente.' });
      }
      if (order.status === 'OPEN' && order.expectedAt && order.expectedAt < now) {
        findings.push({ severity: 'WARN', domain: 'PROCUREMENT', reference: order.number, message: 'Pedido aberto ultrapassou a data prevista de recebimento.' });
      }
    }

    const lastClockByProfessional = new Map<string, string>();
    for (const entry of timeEntries) {
      const previous = lastClockByProfessional.get(entry.professionalId);
      if (!validClockTransition(previous, entry.type)) {
        findings.push({ severity: 'ERROR', domain: 'TEAM', reference: entry.id, message: `Sequência de ponto inválida: ${previous || 'SEM_REGISTRO'} → ${entry.type}.` });
      }
      lastClockByProfessional.set(entry.professionalId, entry.type);
    }
    for (let i = 0; i < payrollRuns.length; i += 1) {
      for (let j = i + 1; j < payrollRuns.length; j += 1) {
        const a = payrollRuns[i];
        const b = payrollRuns[j];
        if (a.periodStart < b.periodEnd && a.periodEnd > b.periodStart) {
          findings.push({ severity: 'ERROR', domain: 'TEAM', reference: `${a.id}:${b.id}`, message: 'Existem fechamentos de folha com períodos sobrepostos.' });
        }
      }
    }

    const appointmentById = new Map(appointments.map((item) => [item.id, item]));
    for (const record of clinicalRecords) {
      if (record.appointmentId) {
        const appointment = appointmentById.get(record.appointmentId);
        if (!appointment) findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Prontuário referencia atendimento inexistente no tenant.' });
        else if (appointment.clientId && appointment.clientId !== record.clientId) findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Cliente do prontuário diverge do cliente do atendimento.' });
      }
      if (record.recordType === 'CONSENT' && (!record.consentText.trim() || !record.signedBy.trim() || !record.signedAt)) {
        findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Consentimento clínico incompleto.' });
      }
    }

    const activePortalByClient = new Map<string, number>();
    for (const access of portalAccesses) {
      if (!access.revokedAt && access.expiresAt > now) activePortalByClient.set(access.clientId, (activePortalByClient.get(access.clientId) || 0) + 1);
      if (!access.revokedAt && access.expiresAt <= now) findings.push({ severity: 'WARN', domain: 'CLIENT_PORTAL', reference: access.id, message: 'Link expirado permanece não revogado.' });
    }
    for (const [clientId, count] of activePortalByClient) {
      if (count > 1) findings.push({ severity: 'ERROR', domain: 'CLIENT_PORTAL', reference: clientId, message: `Cliente possui ${count} links ativos simultaneamente.` });
    }

    const modules = (['WHATSAPP', 'PROCUREMENT', 'TEAM', 'CLINICAL', 'CLIENT_PORTAL'] as const).map((domain) => {
      const moduleFindings = findings.filter((item) => item.domain === domain);
      return {
        domain,
        ok: !moduleFindings.some((item) => item.severity === 'ERROR'),
        errors: moduleFindings.filter((item) => item.severity === 'ERROR').length,
        warnings: moduleFindings.filter((item) => item.severity === 'WARN').length
      };
    });

    const errors = findings.filter((item) => item.severity === 'ERROR').length;
    const warnings = findings.filter((item) => item.severity === 'WARN').length;
    return {
      ok: errors === 0,
      checkedAt: new Date().toISOString(),
      whatsapp: {
        name: whatsapp?.name || 'Não configurado',
        status: whatsapp?.status || 'missing',
        trial: process.env.TWILIO_TRIAL_MODE === 'true',
        activeTemplates: templates.length
      },
      scope: {
        purchaseOrders: orders.length,
        timeEntries: timeEntries.length,
        payrollRuns: payrollRuns.length,
        clinicalRecords: clinicalRecords.length,
        portalAccesses: portalAccesses.length
      },
      summary: { errors, warnings, findings: findings.length },
      modules,
      findings
    };
  });
}
