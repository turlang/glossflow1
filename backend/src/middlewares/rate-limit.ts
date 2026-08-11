import { FastifyInstance } from 'fastify';

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

/**
 * Remove buckets vencidos quando o mapa cresce demais.
 * O limiter continua simples e local ao processo, mas evita crescimento
 * indefinido em serviços long-lived com muitos IPs distintos.
 */
function pruneExpiredBuckets(now: number) {
  if (buckets.size < 5_000) return;

  for (const [ip, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(ip);
  }
}

/**
 * Rate limit de proteção básica por IP.
 *
 * É adequado ao piloto e reduz abuso sem dependência externa. Em múltiplas
 * instâncias, migrar para Redis/API Gateway para compartilhar contadores.
 */
export function registerInMemoryRateLimit(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const windowMs = 60_000;
    const maxRequests = Number(process.env.RATE_LIMIT_PER_MINUTE || 180);
    const now = Date.now();

    pruneExpiredBuckets(now);

    const forwardedFor = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
    const ip = forwardedFor || request.ip || 'unknown';
    const current = buckets.get(ip);

    if (!current || current.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return;
    }

    current.count += 1;
    if (current.count > maxRequests) {
      return reply.status(429).send({
        message: 'Muitas requisições. Tente novamente em alguns instantes.'
      });
    }
  });
}
