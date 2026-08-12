import Fastify from 'fastify';
import { ZodError } from 'zod';
import { registerCorsPolicy } from './config/cors';
import { buildId, isProduction } from './config/environment';
import { registerInMemoryRateLimit } from './middlewares/rate-limit';
import { appRoutes } from './routes/appRoutes';
import { markRequestStarted, recordMetric } from './routes/metrics';
import { captureOperationalError } from './services/sentry.service';

/**
 * Cria a aplicação Fastify sem abrir porta nem iniciar jobs.
 * Esse contrato permite Fastify.inject() em testes sem efeitos colaterais.
 */
export function buildApp() {
  const app = Fastify({ logger: true });

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBody = String(body || '');
    (request as typeof request & { rawBody?: string }).rawBody = rawBody;
    try {
      done(null, rawBody ? JSON.parse(rawBody) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  registerCorsPolicy(app);
  registerInMemoryRateLimit(app);

  app.addHook('onRequest', async (request, reply) => {
    markRequestStarted();
    reply.header('X-Request-Id', request.id);
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-GlossFlow-Build', buildId);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    const elapsed = Math.round(reply.elapsedTime || 0);
    const routePath = request.routeOptions?.url || request.url;
    recordMetric({
      method: request.method,
      path: routePath,
      statusCode: reply.statusCode,
      responseTimeMs: elapsed,
      requestId: request.id,
      createdAt: new Date().toISOString()
    });

    const slowThresholdMs = Math.max(100, Number(process.env.OBSERVABILITY_SLOW_REQUEST_MS || 750));
    if (elapsed >= slowThresholdMs) {
      request.log.warn({
        requestId: request.id,
        method: request.method,
        route: routePath,
        statusCode: reply.statusCode,
        responseTimeMs: elapsed,
        slowThresholdMs
      }, 'slow request');
    }
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ message: 'Rota não encontrada.' }));

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ message: 'Dados inválidos.', issues: error.issues });
    }

    const normalized = error instanceof Error ? error : new Error('Erro interno do servidor.');
    const statusCode = Number((normalized as Error & { statusCode?: number }).statusCode || 500);
    if (statusCode >= 500) {
      app.log.error({ err: normalized, requestId: request.id, method: request.method, url: request.url });
      captureOperationalError(normalized, {
        requestId: request.id,
        method: request.method,
        url: request.url,
        route: request.routeOptions?.url || request.url
      });
    }

    const message = statusCode >= 500 && isProduction ? 'Erro interno do servidor.' : normalized.message;
    return reply.status(statusCode).send({ message });
  });

  app.register(appRoutes);
  return app;
}
