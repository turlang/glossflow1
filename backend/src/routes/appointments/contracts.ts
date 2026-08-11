import { z } from 'zod';
import { objectIdSchema } from '../schemas';

export const availabilityQuerySchema = z.object({
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido. Use YYYY-MM.').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.').optional()
}).strict().refine((value) => Boolean(value.month || value.date), { message: 'Informe month ou date para consultar a disponibilidade.' });

export const smartFitQuerySchema = z.object({
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.')
}).strict();

export const managementQuerySchema = z.object({
  appointmentId: objectIdSchema,
  token: z.string().min(32)
}).strict();

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');

export const waitlistCreateSchema = z.object({
  clientName: z.string().trim().min(3),
  clientPhone: z.string().min(10),
  clientEmail: z.string().email().optional().or(z.literal('')),
  serviceId: objectIdSchema,
  professionalId: objectIdSchema.optional().or(z.literal('')).transform((value) => value || undefined),
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.'),
  earliestTime: timeSchema.optional().default('00:00'),
  latestTime: timeSchema.optional().default('23:59'),
  notes: z.string().max(500).optional().default('')
}).strict().refine((value) => value.earliestTime <= value.latestTime, { path: ['latestTime'], message: 'O horário final deve ser posterior ao horário inicial.' });

export const waitlistUpdateSchema = z.object({
  status: z.enum(['WAITING', 'OFFERED', 'BOOKED', 'CANCELLED']).optional(),
  priority: z.coerce.number().int().min(-5).max(10).optional()
}).strict().refine((value) => value.status !== undefined || value.priority !== undefined, { message: 'Informe status ou prioridade.' });

export const waitlistScanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).strict();

export const idParamSchema = z.object({ id: objectIdSchema }).strict();

export function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function slotInWindow(label: string, earliest: string, latest: string) {
  return label >= earliest && label <= latest;
}
