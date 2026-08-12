import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { buildOpenApiDocument } from '../services/openapi.service';
import { getPrometheusMetrics, recordDependencyMetric } from './metrics';

async function databaseReadiness() {
  const startedAt = Date.now();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    const latencyMs = Date.now() - startedAt;
    recordDependencyMetric({
      dependency: 'mongodb',
      operation: 'ping',
      ok: true,
      latencyMs,
      createdAt: new Date().toISOString()
    });
    return { ok: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    recordDependencyMetric({
      dependency: 'mongodb',
      operation: 'ping',
      ok: false,
      latencyMs,
      errorCode: 'PING_FAILED',
      createdAt: new Date().toISOString()
    });
    return {
      ok: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'MongoDB indisponível.'
    };
  }
}

export async function platformRoutes(app: FastifyInstance) {
  /** Liveness: confirma que o processo Node está aceitando requisições. */
  app.get('/health', async () => ({
    ok: true,
    service: 'glossflow-api',
    version: '10.0.0',
    superAdminBootstrapConfigured: Boolean(
      String(process.env.SUPER_ADMIN_EMAIL || '').trim()
      && String(process.env.SUPER_ADMIN_PASSWORD || '')
    ),
    checkedAt: new Date().toISOString()
  }));

  /** Readiness: só retorna 200 quando configuração mínima e MongoDB estão disponíveis. */
  app.get('/ready', async (_request, reply) => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter((key) => !process.env[key]);
    const integrations = getIntegrationStatus();
    const connected = integrations.filter((item) => item.status === 'connected').length;
    const database = missing.includes('DATABASE_URL')
      ? { ok: false, latencyMs: 0, error: 'DATABASE_URL ausente.' }
      : await databaseReadiness();

    const ready = missing.length === 0 && database.ok;
    return reply.status(ready ? 200 : 503).send({
      ok: ready,
      missing,
      database,
      integrations: { connected, total: integrations.length, items: integrations },
      checkedAt: new Date().toISOString()
    });
  });

  app.get('/openapi.json', async () => buildOpenApiDocument());

  /** Endpoint compatível com coleta Prometheus/Grafana. */
  app.get('/metrics', async (_request, reply) => {
    return reply.header('Content-Type', 'text/plain; version=0.0.4').send(getPrometheusMetrics());
  });
}
