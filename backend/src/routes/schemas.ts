import { z } from 'zod';

/** Schemas de validação compartilhados pelas rotas. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido.');

export const loginSchema = z.object({
  /** Login por e-mail não deve diferenciar maiúsculas/minúsculas. */
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.')
});

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use formato hexadecimal, por exemplo #C49A6C.');

/**
 * O editor Site & Marca aceita URL externa ou upload local convertido para
 * data:image/*;base64. Um arquivo de até 2 MB cresce para cerca de 2,7 MB em
 * base64, portanto o limite de 3 milhões de caracteres mantém o piloto seguro
 * sem bloquear uploads legítimos.
 */
const imageAssetSchema = z.string()
  .max(3_000_000, 'Imagem muito grande. Envie um arquivo de até 2 MB ou use uma URL externa.')
  .refine(
    (value) => !value || value.startsWith('data:image/') || /^https?:\/\//i.test(value),
    'Imagem inválida. Use uma URL http/https ou envie um arquivo de imagem.'
  );

export const salonSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  phone: z.string().min(8),
  whatsapp: z.string().min(8),
  address: z.string().min(5),
  openingHours: z.string().min(3),
  instagram: z.string().optional().default(''),
  heroImage: imageAssetSchema.optional().default(''),
  heroTitle: z.string().max(160).optional(),
  logoUrl: imageAssetSchema.optional().default(''),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  siteTemplate: z.enum(['ELEGANCE', 'LUXURY', 'MINIMAL', 'URBAN']).optional(),
  customDomain: z.string().max(253).optional()
});

export const userSchema = z.object({
  name: z.string().min(2),
  /** Mantém novos usuários no mesmo padrão canônico usado no login. */
  email: z.string().trim().toLowerCase().email(),
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
  quantity: z.coerce.number().int().nonnegative(),
  minimumQuantity: z.coerce.number().int().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative().optional(),
  imageUrl: z.string().optional().default(''),
  active: z.coerce.boolean().optional().default(true)
});

export const inventoryMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().min(2)
});

export const appointmentSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(8),
  clientEmail: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional().default(''),
  startTime: z.string().datetime(),
  serviceId: objectIdSchema,
  professionalId: objectIdSchema
});

export const appointmentUpdateSchema = z.object({
  startTime: z.string().datetime().optional(),
  professionalId: objectIdSchema.optional(),
  status: z.enum(['CONFIRMED', 'CANCELED', 'COMPLETED']).optional()
});
