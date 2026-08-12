import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthContext } from './helpers';
import { SALON_MODULES } from '../services/module-access.service';
import {
  BillingProfile,
  getTenantLifecycleSnapshot,
  provisionTenant,
  SUBSCRIPTION_STATUSES,
  updateTenantLifecycle,
  updateTenantOwner
} from '../services/saas-lifecycle.service';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido.');
const billingSchema = z.object({
  provider: z.enum(['MANUAL', 'MERCADO_PAGO', 'STRIPE', 'OTHER']).default('MANUAL'),
  customerId: z.string().trim().max(160).optional().default(''),
  subscriptionRef: z.string().trim().max(160).optional().default(''),
  nextBillingAt: z.string().optional().default(''),
  notes: z.string().trim().max(500).optional().default('')
}).strict();

const provisioningSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).max(63).regex(/^[a-z0-9][a-z0-9-]*$/, 'Use apenas letras minúsculas, números e hífen no slug.'),
  phone: z.string().trim().min(8),
  whatsapp: z.string().trim().min(8),
  address: z.string().trim().min(5),
  openingHours: z.string().trim().min(3),
  description: z.string().trim().optional().default(''),
  instagram: z.string().trim().optional().default(''),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminPassword: z.string().min(12, 'A senha inicial do administrador precisa ter pelo menos 12 caracteres.'),
  enabledModules: z.array(z.enum(SALON_MODULES)).min(1, 'Selecione pelo menos um módulo.'),
  planId: objectIdSchema,
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE']).default('TRIAL'),
  subscriptionEndsAt: z.string().optional().or(z.literal('')),
  billing: billingSchema.optional()
}).strict();

const lifecycleSchema = z.object({
  planId: objectIdSchema.optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  endsAt: z.string().optional().or(z.literal('')),
  enabledModules: z.array(z.enum(SALON_MODULES)).optional(),
  billing: billingSchema.optional()
}).strict().refine(
  (value) => value.planId || value.status || value.endsAt !== undefined || value.enabledModules || value.billing,
  { message: 'Informe ao menos uma alteração de ciclo de vida.' }
);

const ownerSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(12).optional(),
  active: z.coerce.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos uma alteração do administrador.' });

function actorFromRequest(request: FastifyRequest) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  return {
    userId: user?.id,
    ip: request.ip || '',
    userAgent: String(request.headers['user-agent'] || '')
  };
}

/**
 * Contrato canônico do Marco 21.
 * As rotas legadas de plano/módulos continuam compatíveis, porém o frontend
 * passa a usar este fluxo para provisionar e manter o ciclo SaaS sem edição manual de banco.
 */
export async function platformLifecycleRoutes(app: FastifyInstance) {
  app.post('/platform-admin/provisioning', async (request, reply) => {
    const data = provisioningSchema.parse(request.body);
    const result = await provisionTenant({
      salon: {
        name: data.name,
        slug: data.slug,
        phone: data.phone,
        whatsapp: data.whatsapp,
        address: data.address,
        openingHours: data.openingHours,
        description: data.description,
        instagram: data.instagram
      },
      admin: { name: data.adminName, email: data.adminEmail, password: data.adminPassword },
      enabledModules: data.enabledModules,
      planId: data.planId,
      status: data.subscriptionStatus,
      endsAt: data.subscriptionEndsAt || null,
      billing: data.billing as BillingProfile | undefined,
      actor: actorFromRequest(request)
    });
    return reply.status(201).send(result);
  });

  app.get('/platform-admin/salons/:id/lifecycle', async (request, reply) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const snapshot = await getTenantLifecycleSnapshot(id);
    if (!snapshot) return reply.status(404).send({ message: 'Salão não encontrado.' });
    return snapshot;
  });

  app.put('/platform-admin/salons/:id/lifecycle', async (request) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = lifecycleSchema.parse(request.body);
    return updateTenantLifecycle({
      salonId: id,
      planId: data.planId,
      status: data.status,
      endsAt: data.endsAt,
      enabledModules: data.enabledModules,
      billing: data.billing as BillingProfile | undefined,
      actor: actorFromRequest(request)
    });
  });

  app.put('/platform-admin/salons/:id/owner', async (request) => {
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = ownerSchema.parse(request.body);
    return updateTenantOwner({ salonId: id, ...data, actor: actorFromRequest(request) });
  });
}
