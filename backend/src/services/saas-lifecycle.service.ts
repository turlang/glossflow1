import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { normalizeEnabledModules } from './module-access.service';
import type { SalonModule } from './module-access.service';

export const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export type BillingProfile = {
  provider: 'MANUAL' | 'MERCADO_PAGO' | 'STRIPE' | 'OTHER';
  customerId: string;
  subscriptionRef: string;
  nextBillingAt: string;
  notes: string;
};

export type ActorContext = {
  userId?: string;
  ip?: string;
  userAgent?: string;
};

const DEFAULT_BILLING: BillingProfile = {
  provider: 'MANUAL',
  customerId: '',
  subscriptionRef: '',
  nextBillingAt: '',
  notes: ''
};

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'],
  ACTIVE: ['ACTIVE', 'PAST_DUE', 'CANCELED'],
  PAST_DUE: ['PAST_DUE', 'ACTIVE', 'CANCELED'],
  CANCELED: ['CANCELED', 'ACTIVE']
};

function envDays(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isoOrEmpty(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function nullableDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida para o ciclo de assinatura.');
  return date;
}

function futureDate(days: number, now = new Date()) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function sanitizeBilling(input?: Partial<BillingProfile> | null): BillingProfile {
  const provider = ['MANUAL', 'MERCADO_PAGO', 'STRIPE', 'OTHER'].includes(String(input?.provider))
    ? input?.provider as BillingProfile['provider']
    : DEFAULT_BILLING.provider;
  return {
    provider,
    customerId: String(input?.customerId || '').trim().slice(0, 160),
    subscriptionRef: String(input?.subscriptionRef || '').trim().slice(0, 160),
    nextBillingAt: isoOrEmpty(input?.nextBillingAt),
    notes: String(input?.notes || '').trim().slice(0, 500)
  };
}

export function assertSubscriptionTransition(current: SubscriptionStatus | null, next: SubscriptionStatus) {
  if (!current) return;
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    const error = new Error(`Transição de assinatura inválida: ${current} → ${next}.`);
    (error as Error & { statusCode?: number; code?: string }).statusCode = 409;
    (error as Error & { statusCode?: number; code?: string }).code = 'INVALID_SUBSCRIPTION_TRANSITION';
    throw error;
  }
}

export function evaluateSubscriptionAccess(
  subscription: { status?: string | null; endsAt?: Date | string | null } | null | undefined,
  now = new Date()
) {
  if (!subscription) {
    return { allowed: true, code: 'LEGACY_NO_SUBSCRIPTION', status: 'LEGACY', endsAt: null };
  }

  const status = String(subscription.status || 'TRIAL') as SubscriptionStatus;
  const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
  const beforeEnd = !endsAt || endsAt.getTime() > now.getTime();

  if (status === 'ACTIVE') return { allowed: true, code: 'ACTIVE', status, endsAt };
  if (status === 'TRIAL' && beforeEnd) return { allowed: true, code: 'TRIAL_ACTIVE', status, endsAt };
  if (status === 'PAST_DUE' && beforeEnd) return { allowed: true, code: 'PAST_DUE_GRACE', status, endsAt };
  if (status === 'TRIAL') return { allowed: false, code: 'TRIAL_EXPIRED', status, endsAt };
  if (status === 'PAST_DUE') return { allowed: false, code: 'PAST_DUE_BLOCKED', status, endsAt };
  return { allowed: false, code: 'SUBSCRIPTION_CANCELED', status: 'CANCELED', endsAt };
}

export async function getTenantSubscriptionAccess(salonId: string, now = new Date()) {
  const subscription = await prisma.salonSubscription.findUnique({
    where: { salonId },
    select: { status: true, endsAt: true }
  });
  return evaluateSubscriptionAccess(subscription, now);
}

export async function recordSaasAudit(input: {
  salonId: string;
  action: string;
  resource: string;
  resourceId?: string;
  path: string;
  metadata?: Record<string, unknown>;
  actor?: ActorContext;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      method: 'SAAS',
      path: input.path,
      ip: input.actor?.ip || '',
      userAgent: input.actor?.userAgent || '',
      userId: input.actor?.userId,
      salonId: input.salonId,
      metadata: (input.metadata || {}) as Prisma.InputJsonObject
    }
  });
}

export async function getBillingProfile(salonId: string): Promise<BillingProfile> {
  const last = await prisma.auditLog.findFirst({
    where: { salonId, resource: 'SaasBillingProfile', action: 'SAAS_BILLING_PROFILE_UPDATED' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });
  return sanitizeBilling((last?.metadata || {}) as Partial<BillingProfile>);
}

export async function saveBillingProfile(salonId: string, input: Partial<BillingProfile>, actor?: ActorContext) {
  const billing = sanitizeBilling(input);
  await recordSaasAudit({
    salonId,
    action: 'SAAS_BILLING_PROFILE_UPDATED',
    resource: 'SaasBillingProfile',
    resourceId: salonId,
    path: `/platform-admin/salons/${salonId}/lifecycle`,
    metadata: { ...billing },
    actor
  });
  return billing;
}

function resolveEndsAt(status: SubscriptionStatus, supplied?: string | null, now = new Date()) {
  if (status === 'CANCELED') return nullableDate(supplied) || now;
  const explicit = nullableDate(supplied);
  if (explicit) return explicit;
  if (status === 'TRIAL') return futureDate(envDays('SAAS_DEFAULT_TRIAL_DAYS', 7), now);
  if (status === 'PAST_DUE') return futureDate(envDays('SAAS_PAST_DUE_GRACE_DAYS', 3), now);
  return null;
}

async function ensureAssignablePlan(planId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    const error = new Error('Plano não encontrado.');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  if (!plan.active) {
    const error = new Error('Plano arquivado não pode ser atribuído a um novo contrato.');
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }
  return plan;
}

export async function provisionTenant(input: {
  salon: {
    name: string;
    slug: string;
    phone: string;
    whatsapp: string;
    address: string;
    openingHours: string;
    description?: string;
    instagram?: string;
  };
  admin: { name: string; email: string; password: string };
  enabledModules: SalonModule[];
  planId: string;
  status?: 'TRIAL' | 'ACTIVE';
  endsAt?: string | null;
  billing?: Partial<BillingProfile>;
  actor?: ActorContext;
}) {
  const slug = input.salon.slug.trim().toLowerCase();
  const email = input.admin.email.trim().toLowerCase();
  const status = input.status || 'TRIAL';
  const enabledModules = [...new Set(input.enabledModules)];
  const plan = await ensureAssignablePlan(input.planId);

  const [existingSalon, existingUser] = await Promise.all([
    prisma.salon.findUnique({ where: { slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } })
  ]);
  if (existingSalon) {
    const error = new Error('Já existe um salão com este slug.');
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }
  if (existingUser) {
    const error = new Error('Este e-mail já está cadastrado na plataforma.');
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }

  const salon = await prisma.salon.create({
    data: {
      slug,
      name: input.salon.name,
      description: input.salon.description || '',
      phone: input.salon.phone,
      whatsapp: input.salon.whatsapp,
      address: input.salon.address,
      openingHours: input.salon.openingHours,
      instagram: input.salon.instagram || '',
      heroImage: '',
      modulesConfigured: true,
      enabledModules
    }
  });

  try {
    const admin = await prisma.user.create({
      data: {
        name: input.admin.name,
        email,
        password: await bcrypt.hash(input.admin.password, 12),
        role: 'ADMIN',
        active: true,
        salonId: salon.id
      }
    });

    const subscription = await prisma.salonSubscription.create({
      data: {
        salonId: salon.id,
        planId: plan.id,
        status,
        endsAt: resolveEndsAt(status, input.endsAt)
      },
      include: { plan: true }
    });

    const billing = await saveBillingProfile(salon.id, input.billing || DEFAULT_BILLING, input.actor);
    await recordSaasAudit({
      salonId: salon.id,
      action: 'SAAS_TENANT_PROVISIONED',
      resource: 'SaasTenant',
      resourceId: salon.id,
      path: '/platform-admin/provisioning',
      metadata: {
        slug: salon.slug,
        adminId: admin.id,
        adminEmail: admin.email,
        planId: plan.id,
        planName: plan.name,
        status,
        endsAt: subscription.endsAt?.toISOString() || null,
        enabledModules
      },
      actor: input.actor
    });

    return {
      salon: { id: salon.id, slug: salon.slug, name: salon.name, enabledModules: normalizeEnabledModules(salon) },
      owner: { id: admin.id, name: admin.name, email: admin.email, active: admin.active },
      subscription,
      billing,
      access: evaluateSubscriptionAccess(subscription)
    };
  } catch (error) {
    await prisma.auditLog.deleteMany({ where: { salonId: salon.id } }).catch(() => undefined);
    await prisma.userSession.deleteMany({ where: { salonId: salon.id } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { salonId: salon.id } }).catch(() => undefined);
    await prisma.salonSubscription.deleteMany({ where: { salonId: salon.id } }).catch(() => undefined);
    await prisma.salon.delete({ where: { id: salon.id } }).catch(() => undefined);
    throw error;
  }
}

export async function updateTenantLifecycle(input: {
  salonId: string;
  planId?: string;
  status?: SubscriptionStatus;
  endsAt?: string | null;
  enabledModules?: SalonModule[];
  billing?: Partial<BillingProfile>;
  actor?: ActorContext;
}) {
  const salon = await prisma.salon.findUnique({ where: { id: input.salonId } });
  if (!salon || salon.slug === 'glossflow-platform') {
    const error = new Error('Salão não encontrado.');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const current = await prisma.salonSubscription.findUnique({
    where: { salonId: input.salonId },
    include: { plan: true }
  });

  let subscription = current;
  if (input.planId || input.status || input.endsAt !== undefined) {
    const planId = input.planId || current?.planId;
    if (!planId) {
      const error = new Error('Escolha um plano antes de alterar a assinatura.');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    if (!current || planId !== current.planId) await ensureAssignablePlan(planId);
    const nextStatus = input.status || (current?.status as SubscriptionStatus | undefined) || 'TRIAL';
    assertSubscriptionTransition(current?.status as SubscriptionStatus | null, nextStatus);
    const nextEndsAt = input.endsAt !== undefined
      ? resolveEndsAt(nextStatus, input.endsAt)
      : current?.status === nextStatus
        ? current?.endsAt || resolveEndsAt(nextStatus)
        : resolveEndsAt(nextStatus);

    subscription = await prisma.salonSubscription.upsert({
      where: { salonId: input.salonId },
      create: { salonId: input.salonId, planId, status: nextStatus, endsAt: nextEndsAt },
      update: { planId, status: nextStatus, endsAt: nextEndsAt },
      include: { plan: true }
    });

    if (nextStatus === 'CANCELED') {
      await prisma.userSession.updateMany({
        where: { salonId: input.salonId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await recordSaasAudit({
      salonId: input.salonId,
      action: 'SAAS_SUBSCRIPTION_CHANGED',
      resource: 'SalonSubscription',
      resourceId: subscription.id,
      path: `/platform-admin/salons/${input.salonId}/lifecycle`,
      metadata: {
        before: current ? { planId: current.planId, status: current.status, endsAt: current.endsAt?.toISOString() || null } : null,
        after: { planId: subscription.planId, status: subscription.status, endsAt: subscription.endsAt?.toISOString() || null }
      },
      actor: input.actor
    });
  }

  let modules = normalizeEnabledModules(salon);
  if (input.enabledModules) {
    const enabledModules = [...new Set(input.enabledModules)];
    const updated = await prisma.salon.update({
      where: { id: input.salonId },
      data: { modulesConfigured: true, enabledModules }
    });
    modules = normalizeEnabledModules(updated);
    await recordSaasAudit({
      salonId: input.salonId,
      action: 'SAAS_MODULES_UPDATED',
      resource: 'SalonModules',
      resourceId: input.salonId,
      path: `/platform-admin/salons/${input.salonId}/lifecycle`,
      metadata: { before: normalizeEnabledModules(salon), after: modules },
      actor: input.actor
    });
  }

  const billing = input.billing ? await saveBillingProfile(input.salonId, input.billing, input.actor) : await getBillingProfile(input.salonId);
  return {
    salon: { id: salon.id, name: salon.name, slug: salon.slug, customDomain: salon.customDomain, enabledModules: modules },
    subscription,
    billing,
    access: evaluateSubscriptionAccess(subscription)
  };
}

export async function updateTenantOwner(input: {
  salonId: string;
  name?: string;
  email?: string;
  password?: string;
  active?: boolean;
  actor?: ActorContext;
}) {
  const salon = await prisma.salon.findUnique({ where: { id: input.salonId }, select: { id: true, slug: true } });
  if (!salon || salon.slug === 'glossflow-platform') {
    const error = new Error('Salão não encontrado.');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const admin = await prisma.user.findFirst({ where: { salonId: input.salonId, role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) {
    const error = new Error('Administrador principal deste salão não foi encontrado.');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const nextEmail = input.email?.trim().toLowerCase();
  if (nextEmail && nextEmail !== admin.email) {
    const collision = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
    if (collision) {
      const error = new Error('Este e-mail já está em uso.');
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }
  }

  const securityChanged = Boolean(input.password) || input.active === false;
  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(nextEmail ? { email: nextEmail } : {}),
      ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
      ...(input.password ? { password: await bcrypt.hash(input.password, 12) } : {})
    }
  });

  if (securityChanged) {
    await prisma.userSession.updateMany({
      where: { userId: admin.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  await recordSaasAudit({
    salonId: input.salonId,
    action: 'SAAS_ADMIN_ACCESS_UPDATED',
    resource: 'TenantOwner',
    resourceId: admin.id,
    path: `/platform-admin/salons/${input.salonId}/owner`,
    metadata: {
      before: { name: admin.name, email: admin.email, active: admin.active },
      after: { name: updated.name, email: updated.email, active: updated.active },
      passwordRotated: Boolean(input.password),
      sessionsRevoked: securityChanged
    },
    actor: input.actor
  });

  return { id: updated.id, name: updated.name, email: updated.email, active: updated.active, sessionsRevoked: securityChanged };
}

export async function getTenantLifecycleSnapshot(salonId: string) {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    include: {
      subscription: { include: { plan: true } },
      users: { where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, name: true, email: true, active: true } }
    }
  });
  if (!salon || salon.slug === 'glossflow-platform') return null;

  const [billing, lastLifecycleEvent] = await Promise.all([
    getBillingProfile(salonId),
    prisma.auditLog.findFirst({
      where: { salonId, action: { in: ['SAAS_TENANT_PROVISIONED', 'SAAS_SUBSCRIPTION_CHANGED', 'SAAS_MODULES_UPDATED', 'SAAS_ADMIN_ACCESS_UPDATED', 'SAAS_BILLING_PROFILE_UPDATED'] } },
      orderBy: { createdAt: 'desc' },
      select: { action: true, createdAt: true, metadata: true }
    })
  ]);

  return {
    salon: {
      id: salon.id,
      slug: salon.slug,
      name: salon.name,
      customDomain: salon.customDomain,
      modulesConfigured: salon.modulesConfigured,
      enabledModules: normalizeEnabledModules(salon)
    },
    owner: salon.users[0] || null,
    subscription: salon.subscription,
    access: evaluateSubscriptionAccess(salon.subscription),
    billing,
    billingReady: billing.provider === 'MANUAL' || Boolean(billing.customerId && billing.subscriptionRef),
    lastLifecycleEvent
  };
}
