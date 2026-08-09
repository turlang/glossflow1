import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { appRoutes } from './routes/appRoutes';
import { recordMetric } from './routes/metrics';
import { captureOperationalError } from './services/sentry.service';
import { prisma } from './lib/prisma';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validação mínima de variáveis críticas.
 * Em produção, a API não deve subir com configuração insegura ou incompleta.
 */
function assertRequiredProductionEnv() {
  if (!isProduction) return;

  const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`);
  }

  if ((process.env.JWT_SECRET || '').length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção.');
  }
}

assertRequiredProductionEnv();

const app = Fastify({ logger: true });

/**
 * Configuração de CORS.
 * - FRONTEND_ORIGIN mantém origens administrativas/demonstração explícitas.
 * - PUBLIC_ROOT_DOMAIN libera subdomínios white-label do GlossFlow.
 * - domínios próprios cadastrados no Salon são reconhecidos dinamicamente.
 */
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const rootDomain = (process.env.PUBLIC_ROOT_DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

async function isAllowedOrigin(origin: string) {
  if (allowedOrigins.includes(origin)) return true;
  if (!isProduction && developmentOrigins.includes(origin)) return true;

  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }

  if (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))) {
    return true;
  }

  if (isProduction && hostname) {
    const salon = await prisma.salon.findFirst({ where: { customDomain: hostname }, select: { id: true } });
    if (salon) return true;
  }

  return false;
}

app.register(cors, {
  origin: (origin, callback) => {
    /** Chamadas server-side, Postman e healthchecks podem não enviar Origin. */
    if (!origin) return callback(null, true);

    isAllowedOrigin(origin)
      .then((allowed) => {
        if (allowed) return callback(null, true);
        return callback(new Error(`Origem não permitida pelo CORS: ${origin}`), false);
      })
      .catch((error) => callback(error, false));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Salon-Slug', 'X-Salon-Host'],
  credentials: true
});

/**
 * Rate limit simples em memória.
 * Não substitui soluções distribuídas como Redis, Cloudflare ou API Gateway,
 * mas reduz abuso em ambiente de MVP/piloto sem adicionar dependências.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
app.addHook('onRequest', async (request, reply) => {
  const windowMs = 60_000;
  const maxRequests = Number(process.env.RATE_LIMIT_PER_MINUTE || 180);
  const now = Date.now();
  const forwardedFor = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const ip = forwardedFor || request.ip || 'unknown';
  const current = buckets.get(ip);

  if (!current || current.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > maxRequests) {
    return reply.status(429).send({ message: 'Muitas requisições. Tente novamente em alguns instantes.' });
  }
});

/**
 * Cabeçalhos básicos de segurança.
 * Mantidos sem dependência externa para preservar simplicidade de instalação.
 */
app.addHook('onSend', async (_request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('Cross-Origin-Resource-Policy', 'same-site');
  return payload;
});

/**
 * Observabilidade nativa: cada resposta registra latência, método, rota e status.
 * Em produção, este hook pode alimentar OpenTelemetry, Prometheus ou Sentry.
 */
app.addHook('onResponse', async (request, reply) => {
  recordMetric({
    method: request.method,
    path: request.url,
    statusCode: reply.statusCode,
    responseTimeMs: Math.round(reply.elapsedTime || 0),
    createdAt: new Date().toISOString()
  });
});

app.setNotFoundHandler((_request, reply) => {
  return reply.status(404).send({ message: 'Rota não encontrada.' });
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ message: 'Dados inválidos.', issues: error.issues });
  }

  const statusCode = Number((error as Error & { statusCode?: number }).statusCode || 500);

  if (statusCode >= 500) {
    app.log.error(error);
    captureOperationalError(error, { method: _request.method, url: _request.url });
  }

  const message = statusCode >= 500 && isProduction
    ? 'Erro interno do servidor.'
    : (error.message || 'Erro interno do servidor.');

  return reply.status(statusCode).send({ message });
});

app.register(appRoutes);

const start = async () => {
  const port = Number(process.env.PORT) || 3333;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 GlossFlow API rodando em http://localhost:${port}`);
};

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
