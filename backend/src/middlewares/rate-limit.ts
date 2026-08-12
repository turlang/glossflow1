import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthContext } from '../routes/helpers';

type RateBucket = {
  count: number;
  resetAt: number;
};

type RatePolicy = {
  surface: string;
  maxRequests: number;
};

const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Política de baixa cardinalidade por superfície pública. */
export function rateLimitPolicyFor(method: string, url: string): RatePolicy {
  const path = String(url || '').split('?')[0];
  const verb = String(method || 'GET').toUpperCase();

  if (verb === 'POST' && path === '/auth/login') {
    return { surface: 'auth-login', maxRequests: positiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE, 12) };
  }
  if (verb === 'POST' && path === '/auth/refresh') {
    return { surface: 'auth-refresh', maxRequests: positiveInt(process.env.AUTH_REFRESH_RATE_LIMIT_PER_MINUTE, 60) };
  }
  if (path.startsWith('/webhooks/')) {
    return { surface: 'webhook', maxRequests: positiveInt(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE, 600) };
  }
  if (verb !== 'GET' && (path === '/appointments' || path.includes('/waitlist') || path.includes('/manage'))) {
    return { surface: 'public-write', maxRequests: positiveInt(process.env.PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE, 90) };
  }
  return { surface: 'global', maxRequests: positiveInt(process.env.RATE_LIMIT_PER_MINUTE, 180) };
}

function tenantPolicyFor(method: string, url: string): RatePolicy {
  const path = String(url || '').split('?')[0];
  const verb = String(method || 'GET').toUpperCase();
  if (verb !== 'GET' && path.startsWith('/admin/security/')) {
    return { surface: 'tenant-security-write', maxRequests: positiveInt(process.env.TENANT_SECURITY_RATE_LIMIT_PER_MINUTE, 30) };
  }
  return { surface: 'tenant-authenticated', maxRequests: positiveInt(process.env.TENANT_RATE_LIMIT_PER_MINUTE, 600) };
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(request: FastifyRequest) {
  const forwardedFor = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  return forwardedFor || request.ip || 'unknown';
}

function consume(key: string, policy: RatePolicy, reply: FastifyReply) {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count <= policy.maxRequests) return;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  reply.header('Retry-After', String(retryAfter));
  return reply.status(429).send({
    message: 'Muitas requisições. Tente novamente em alguns instantes.',
    code: 'RATE_LIMITED',
    surface: policy.surface,
    retryAfterSeconds: retryAfter
  });
}

/** Limite por IP e superfície antes de autenticação. */
export function registerInMemoryRateLimit(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const policy = rateLimitPolicyFor(request.method, request.url);
    return consume(`ip:${policy.surface}:${clientIp(request)}`, policy, reply);
  });
}

/**
 * Segundo limite aplicado depois de ensureAuthenticated.
 * Protege a capacidade de um tenant mesmo quando múltiplos IPs/tokens participam.
 */
export async function enforceTenantRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId) return;
  const policy = tenantPolicyFor(request.method, request.url);
  return consume(`tenant:${policy.surface}:${user.salonId}`, policy, reply);
}

/** Somente para testes unitários. */
export function resetRateLimitBucketsForTests() {
  buckets.clear();
}
