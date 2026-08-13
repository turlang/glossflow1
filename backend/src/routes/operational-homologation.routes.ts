import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

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

type Finding = { severity: 'ERROR' | 'WARN'; domain: string; reference: string; message: string };

const payrollEntriesSchema = z.array(z.object({
  professionalId: z.string(),
  baseAmount: z.coerce.number().default(0),
  commissionAmount: z.coerce.number().default(0),
  bonusAmount: z.coerce.number().default(0),
  deductions: z.coerce.number().default(0),
  total: z.coerce.number()
}).passthrough());

/** Marco 35 — Etapa 3: diagnóstico somente leitura de Equipe → Clínico → Portal → Recursos. */
export async function operationalHomologationRoutes(app: FastifyInstance) {
  app.get('/admin/homologation/operations', async (request) => {
    const current = requireAdmin(request);
    const salonId = current.salonId;
    const now = new Date();

    const [professionals, clients, appointments, timeEntries, goals, payrollRuns, clinicalRecords, portalAccesses, resources, reservations] = await Promise.all([
      prisma.professional.findMany({ where: { salonId }, select: { id: true, active: true } }),
      prisma.client.findMany({ where: { salonId }, select: { id: true } }),
      prisma.appointment.findMany({ where: { salonId }, select: { id: true, clientId: true } }),
      prisma.timeClockEntry.findMany({ where: { salonId }, orderBy: { occurredAt: 'desc' }, take: 500 }),
      prisma.staffGoal.findMany({ where: { salonId }, orderBy: { periodStart: 'desc' }, take: 300 }),
      prisma.payrollRun.findMany({ where: { salonId }, orderBy: { periodStart: 'desc' }, take: 100 }),
      prisma.clinicalRecord.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.clientPortalAccess.findMany({ where: { salonId }, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.businessResource.findMany({ where: { salonId } }),
      prisma.resourceReservation.findMany({ where: { salonId }, orderBy: { startTime: 'desc' }, take: 1000 })
    ]);

    const findings: Finding[] = [];
    const professionalById = new Map(professionals.map((item) => [item.id, item]));
    const clientIds = new Set(clients.map((item) => item.id));
    const appointmentById = new Map(appointments.map((item) => [item.id, item]));
    const resourceById = new Map(resources.map((item) => [item.id, item]));

    for (const entry of timeEntries) {
      const professional = professionalById.get(entry.professionalId);
      if (!professional) findings.push({ severity: 'ERROR', domain: 'TEAM_CLOCK', reference: entry.id, message: 'Registro de ponto referencia profissional inexistente no tenant.' });
      else if (!professional.active) findings.push({ severity: 'WARN', domain: 'TEAM_CLOCK', reference: entry.id, message: 'Registro recente de ponto pertence a profissional atualmente inativo.' });
    }

    for (const goal of goals) {
      if (!professionalById.has(goal.professionalId)) findings.push({ severity: 'ERROR', domain: 'TEAM_GOAL', reference: goal.id, message: 'Meta referencia profissional inexistente no tenant.' });
      if (goal.periodEnd <= goal.periodStart) findings.push({ severity: 'ERROR', domain: 'TEAM_GOAL', reference: goal.id, message: 'Meta possui período inválido.' });
      if (goal.target <= 0) findings.push({ severity: 'ERROR', domain: 'TEAM_GOAL', reference: goal.id, message: 'Meta possui alvo não positivo.' });
    }

    for (const payroll of payrollRuns) {
      if (payroll.periodEnd <= payroll.periodStart) findings.push({ severity: 'ERROR', domain: 'TEAM_PAYROLL', reference: payroll.id, message: 'Fechamento possui período inválido.' });
      const parsed = payrollEntriesSchema.safeParse(payroll.entries);
      if (!parsed.success) {
        findings.push({ severity: 'ERROR', domain: 'TEAM_PAYROLL', reference: payroll.id, message: 'Entradas da folha não seguem o contrato esperado.' });
        continue;
      }
      let calculatedGross = 0;
      for (const entry of parsed.data) {
        if (!professionalById.has(entry.professionalId)) findings.push({ severity: 'ERROR', domain: 'TEAM_PAYROLL', reference: payroll.id, message: `Folha referencia profissional fora do tenant: ${entry.professionalId}.` });
        const expected = Number(Math.max(entry.baseAmount + entry.commissionAmount + entry.bonusAmount - entry.deductions, 0).toFixed(2));
        if (Math.abs(expected - entry.total) > 0.01) findings.push({ severity: 'ERROR', domain: 'TEAM_PAYROLL', reference: payroll.id, message: `Total inconsistente para profissional ${entry.professionalId}.` });
        calculatedGross += entry.total;
      }
      if (Math.abs(Number(calculatedGross.toFixed(2)) - payroll.grossTotal) > 0.01) findings.push({ severity: 'ERROR', domain: 'TEAM_PAYROLL', reference: payroll.id, message: 'Gross total da folha diverge da soma das entradas.' });
    }

    for (const record of clinicalRecords) {
      if (!clientIds.has(record.clientId)) findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Prontuário referencia cliente inexistente no tenant.' });
      if (record.appointmentId) {
        const appointment = appointmentById.get(record.appointmentId);
        if (!appointment) findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Prontuário referencia atendimento inexistente no tenant.' });
        else if (appointment.clientId && appointment.clientId !== record.clientId) findings.push({ severity: 'ERROR', domain: 'CLINICAL', reference: record.id, message: 'Cliente do prontuário diverge do cliente do atendimento vinculado.' });
      }
      if (record.recordType === 'CONSENT' && (!record.consentText.trim() || !record.signedBy.trim() || !record.signedAt)) {
        findings.push({ severity: 'WARN', domain: 'CLINICAL_CONSENT', reference: record.id, message: 'Consentimento clínico incompleto: texto, responsável e assinatura/data devem estar registrados.' });
      }
    }

    for (const access of portalAccesses) {
      if (!clientIds.has(access.clientId)) findings.push({ severity: 'ERROR', domain: 'CLIENT_PORTAL', reference: access.id, message: 'Acesso do portal referencia cliente inexistente no tenant.' });
      if (!/^[a-f\d]{64}$/i.test(access.tokenHash)) findings.push({ severity: 'ERROR', domain: 'CLIENT_PORTAL', reference: access.id, message: 'Hash de token do portal fora do padrão SHA-256.' });
      if (!access.revokedAt && access.expiresAt <= now) findings.push({ severity: 'WARN', domain: 'CLIENT_PORTAL', reference: access.id, message: 'Link expirado permanece não revogado; o endpoint público ainda o bloqueia por validade.' });
      if (access.lastUsedAt && access.lastUsedAt > access.expiresAt) findings.push({ severity: 'ERROR', domain: 'CLIENT_PORTAL', reference: access.id, message: 'Link registra uso posterior à expiração.' });
    }

    const overbookedResources = new Set<string>();
    for (const reservation of reservations) {
      const resource = resourceById.get(reservation.resourceId);
      if (!resource) {
        findings.push({ severity: 'ERROR', domain: 'RESOURCES', reference: reservation.id, message: 'Reserva referencia recurso inexistente no tenant.' });
        continue;
      }
      if (reservation.endTime <= reservation.startTime) findings.push({ severity: 'ERROR', domain: 'RESOURCES', reference: reservation.id, message: 'Reserva possui intervalo inválido.' });
      if (reservation.appointmentId && !appointmentById.has(reservation.appointmentId)) findings.push({ severity: 'ERROR', domain: 'RESOURCES', reference: reservation.id, message: 'Reserva referencia atendimento inexistente no tenant.' });
      if (reservation.status === 'RESERVED' && !resource.active && reservation.endTime > now) findings.push({ severity: 'WARN', domain: 'RESOURCES', reference: reservation.id, message: 'Reserva futura está vinculada a recurso inativo.' });
      if (reservation.status === 'RESERVED' && !overbookedResources.has(resource.id)) {
        const simultaneous = reservations.filter((candidate) => candidate.resourceId === resource.id && candidate.status === 'RESERVED' && candidate.startTime < reservation.endTime && candidate.endTime > reservation.startTime).length;
        if (simultaneous > resource.capacity) {
          overbookedResources.add(resource.id);
          findings.push({ severity: 'ERROR', domain: 'RESOURCES_CAPACITY', reference: resource.id, message: `Capacidade excedida: ${simultaneous} reservas simultâneas para capacidade ${resource.capacity}.` });
        }
      }
    }

    const errors = findings.filter((finding) => finding.severity === 'ERROR').length;
    const warnings = findings.filter((finding) => finding.severity === 'WARN').length;
    return {
      ok: errors === 0,
      checkedAt: new Date().toISOString(),
      scope: {
        professionals: professionals.length,
        timeEntries: timeEntries.length,
        goals: goals.length,
        payrollRuns: payrollRuns.length,
        clinicalRecords: clinicalRecords.length,
        portalAccesses: portalAccesses.length,
        resources: resources.length,
        reservations: reservations.length
      },
      summary: { errors, warnings, findings: findings.length },
      findings
    };
  });
}
