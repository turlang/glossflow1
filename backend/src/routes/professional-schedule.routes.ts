import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { defaultWeeklySchedule, parseTimeBlocks } from '../services/professional-schedule.service';
import { getTenant } from './helpers';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');
const interval = z.object({ start: time, end: time }).refine((value) => value.start < value.end, 'O início deve ser anterior ao fim.');
const day = z.object({
  enabled: z.boolean(),
  start: time,
  end: time,
  breaks: z.array(interval).max(4).default([])
}).superRefine((value, ctx) => {
  if (!value.enabled) return;
  if (value.start >= value.end) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'A saída deve ser posterior à entrada.' });
  for (const [index, item] of value.breaks.entries()) {
    if (item.start < value.start || item.end > value.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['breaks', index], message: 'O intervalo precisa estar dentro da jornada.' });
    }
  }
});

const weeklyScheduleSchema = z.object({
  sun: day, mon: day, tue: day, wed: day, thu: day, fri: day, sat: day
});

const updateScheduleSchema = z.object({
  workScheduleConfigured: z.boolean().default(true),
  weeklySchedule: weeklyScheduleSchema
});

const blockSchema = z.object({
  type: z.enum(['VACATION', 'TIME_OFF', 'BLOCK']).default('BLOCK'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().trim().max(180).optional().default('')
}).refine((value) => new Date(value.startTime) < new Date(value.endTime), {
  message: 'O fim do bloqueio deve ser posterior ao início.'
});

const idParams = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) });
const blockParams = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/), blockId: z.string().uuid() });

function ensureManager(role: string, reply: FastifyReply) {
  if (['ADMIN', 'RECEPTION'].includes(role)) return true;
  reply.status(403).send({ message: 'Somente administração ou recepção podem alterar a jornada da equipe.' });
  return false;
}

export async function professionalScheduleRoutes(app: FastifyInstance) {
  app.get('/admin/appointments/team-schedules', async (request, reply) => {
    const tenant = getTenant(request);
    if (!ensureManager(tenant.role, reply)) return;
    const [salon, professionals] = await Promise.all([
      prisma.salon.findUnique({ where: { id: tenant.salonId }, select: { openingHours: true } }),
      prisma.professional.findMany({
        where: { salonId: tenant.salonId, active: true },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, specialty: true, photoUrl: true,
          workScheduleConfigured: true, weeklySchedule: true, timeBlocks: true
        }
      })
    ]);

    const openingHours = salon?.openingHours || '';
    return {
      openingHours,
      defaultSchedule: defaultWeeklySchedule(openingHours),
      professionals: professionals.map((professional) => ({
        ...professional,
        timeBlocks: parseTimeBlocks(professional)
      }))
    };
  });

  app.put('/admin/appointments/team-schedules/:id', async (request, reply) => {
    const tenant = getTenant(request);
    if (!ensureManager(tenant.role, reply)) return;
    const { id } = idParams.parse(request.params);
    const data = updateScheduleSchema.parse(request.body);
    const current = await prisma.professional.findFirst({ where: { id, salonId: tenant.salonId, active: true } });
    if (!current) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });

    return prisma.professional.update({
      where: { id },
      data: {
        workScheduleConfigured: data.workScheduleConfigured,
        weeklySchedule: data.weeklySchedule as Prisma.InputJsonValue
      }
    });
  });

  app.post('/admin/appointments/team-schedules/:id/blocks', async (request, reply) => {
    const tenant = getTenant(request);
    if (!ensureManager(tenant.role, reply)) return;
    const { id } = idParams.parse(request.params);
    const data = blockSchema.parse(request.body);
    const professional = await prisma.professional.findFirst({ where: { id, salonId: tenant.salonId, active: true } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });

    const blocks = parseTimeBlocks(professional);
    const created = {
      id: randomUUID(),
      type: data.type,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      reason: data.reason
    };
    const next = [...blocks, created].sort((a, b) => a.startTime.localeCompare(b.startTime));

    await prisma.professional.update({ where: { id }, data: { timeBlocks: next as Prisma.InputJsonValue } });
    return reply.status(201).send(created);
  });

  app.delete('/admin/appointments/team-schedules/:id/blocks/:blockId', async (request, reply) => {
    const tenant = getTenant(request);
    if (!ensureManager(tenant.role, reply)) return;
    const { id, blockId } = blockParams.parse(request.params);
    const professional = await prisma.professional.findFirst({ where: { id, salonId: tenant.salonId, active: true } });
    if (!professional) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });

    const blocks = parseTimeBlocks(professional);
    const next = blocks.filter((block) => block.id !== blockId);
    if (next.length === blocks.length) return reply.status(404).send({ message: 'Bloqueio não encontrado.' });
    await prisma.professional.update({ where: { id }, data: { timeBlocks: next as Prisma.InputJsonValue } });
    return reply.status(204).send();
  });
}
