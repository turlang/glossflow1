import { z } from 'zod';

/** Schemas de validação compartilhados pelas rotas. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido.');

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.')
});

export const salonSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  phone: z.string().min(8),
  whatsapp: z.string().min(8),
  address: z.string().min(5),
  openingHours: z.string().min(3),
  instagram: z.string().optional().default(''),
  heroImage: z.string().optional().default('')
});

export const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'RECEPTION', 'PROFESSIONAL']).default('RECEPTION'),
  active: z.coerce.boolean().optional().default(true)
});

export const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().positive(),
  durationMin: z.coerce.number().int().positive(),
  imageUrl: z.string().optional().default(''),
  active: z.coerce.boolean().optional().default(true)
});

export const professionalSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().min(2),
  bio: z.string().min(5),
  photoUrl: z.string().optional().default(''),
  active: z.coerce.boolean().optional().default(true)
});

export const portfolioSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(5),
  imageUrl: z.string().min(5),
  category: z.string().min(2)
});

export const inventoryProductSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  supplier: z.string().optional().default(''),
  unit: z.string().min(1).default('un'),
  quantity: z.coerce.number().int().min(0),
  minimumQuantity: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0).optional().or(z.literal('')).transform((value) => value === '' ? null : value),
  imageUrl: z.string().optional().default(''),
  active: z.coerce.boolean().optional().default(true)
});

export const inventoryMovementSchema = z.object({
  productId: objectIdSchema,
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().min(3)
});

export const appointmentSchema = z.object({
  clientName: z.string().min(3),
  clientPhone: z.string().min(10),
  clientEmail: z.string().email().optional().or(z.literal('')),
  startTime: z.string().datetime(),
  serviceId: objectIdSchema,
  professionalId: objectIdSchema,
  notes: z.string().optional().default('')
});

export const appointmentUpdateSchema = z.object({
  startTime: z.string().datetime().optional(),
  professionalId: objectIdSchema.optional(),
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW']).optional()
});

/** Schemas dos módulos avançados da versão SaaS Pro. */
export const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().default(''),
  preferences: z.string().optional().default('')
});

export const financialEntrySchema = z.object({
  type: z.enum(['REVENUE', 'EXPENSE']),
  category: z.string().min(2),
  description: z.string().min(3),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().optional().default(''),
  referenceDate: z.string().optional().or(z.literal('')),
  paid: z.coerce.boolean().optional().default(true)
});

export const commissionRuleSchema = z.object({
  professionalId: objectIdSchema,
  percentage: z.coerce.number().min(0).max(100),
  active: z.coerce.boolean().optional().default(true),
  notes: z.string().optional().default('')
});

export const loyaltyProgramSchema = z.object({
  name: z.string().min(2),
  pointsPerCurrency: z.coerce.number().positive(),
  rewardDescription: z.string().min(3),
  active: z.coerce.boolean().optional().default(true)
});

export const loyaltyEntrySchema = z.object({
  clientId: objectIdSchema,
  type: z.enum(['EARN', 'REDEEM', 'ADJUSTMENT']),
  points: z.coerce.number().int(),
  reason: z.string().min(3)
});

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().min(0),
  maxUsers: z.coerce.number().int().positive(),
  maxSalons: z.coerce.number().int().positive().default(1),
  features: z.string().min(3),
  active: z.coerce.boolean().optional().default(true)
});

export const salonSubscriptionSchema = z.object({
  planId: objectIdSchema,
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).default('TRIAL'),
  endsAt: z.string().optional().or(z.literal(''))
});

export const whatsappTemplateSchema = z.object({
  name: z.string().min(2),
  event: z.enum(['APPOINTMENT_CREATED', 'REMINDER', 'BIRTHDAY', 'PROMOTION', 'AFTER_SERVICE', 'INACTIVE_CLIENT', 'REVIEW_REQUEST', 'NO_SHOW']),
  message: z.string().min(10),
  active: z.coerce.boolean().optional().default(true)
});
