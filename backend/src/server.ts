import 'dotenv/config';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { registerCorsPolicy } from './config/cors';
import { assertRequiredProductionEnv, buildId, isProduction } from './config/environment';
import { registerInMemoryRateLimit } from './middlewares/rate-limit';
import { appRoutes } from './routes/appRoutes';
import { recordMetric } from './routes/metrics';
import { captureOperationalError } from './services/sentry.service';
import { ensureSuperAdminFromEnv } from './services/super-admin-bootstrap.service';
import { startReminderScheduler } from './services/reminder-scheduler.service';

/**
 * Bootstrap da API GlossFlow.
 *
 * Este arquivo apenas compõe infraestrutura transversal e inicia o servidor.
 * Regras de ambiente, CORS, rate limit e agendadores ficam em módulos próprios
 * para manter o entrypoint pequeno e auditável.
 */
assertRequiredProductionEnv();

const app = Fastify({ logger: true });

/**
 * Mantém o corpo JSON bruto para validar X-Hub-Signature-256 da Meta quando
 * esse provider estiver habilitado. Depois da captura, as rotas recebem JSON.
 */
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

/**
 * Cabeçalhos básicos de segurança.
 * `X-GlossFlow-Build` permite confirmar rapidamente se Render e GitHub estão
 * executando o mesmo commit durante suporte e validação de deploy.
 */
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

/** Registra latência, método, rota e status para observabilidade nativa. */
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

/**
 * Normaliza erros de validação e impede vazamento de detalhes internos em 5xx
 * de produção. Erros inesperados continuam indo para log/observabilidade.
 */
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ message: 'Dados inválidos.', issues: error.issues });
  }

  const statusCode = Number((error as Error & { statusCode?: number }).statusCode || 500);

  if (statusCode >= 500) {
    app.log.error(error);
    captureOperationalError(error, { method: request.method, url: request.url });
  }

  const message = statusCode >= 500 && isProduction
    ? 'Erro interno do servidor.'
    : (error.message || 'Erro interno do servidor.');

  return reply.status(statusCode).send({ message });
});

app.register(appRoutes);

/**
 * Inicialização controlada da API.
 * O Super Admin é garantido de forma idempotente antes de aceitar tráfego.
 */
async function start() {
  const port = Number(process.env.PORT) || 3333;

  await ensureSuperAdminFromEnv({
    info: (message) => app.log.info(message),
    warn: (message) => app.log.warn(message)
  });

  await app.listen({ port, host: '0.0.0.0' });
  startReminderScheduler(app.log);
  app.log.info(`GlossFlow API rodando na porta ${port} • build ${buildId}`);
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
