import { FastifyInstance } from 'fastify';
import { getIntegrationStatus } from '../services/integrationStatus.service';
import { buildOpenApiDocument } from '../services/openapi.service';
import { getPrometheusMetrics } from './metrics';

export async function platformRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'glossflow-api', version: '10.0.0', checkedAt: new Date().toISOString() }));

  app.get('/ready', async (_request, reply) => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter((key) => !process.env[key]);
    const integrations = getIntegrationStatus();
    const connected = integrations.filter((item) => item.status === 'connected').length;

    const ready = missing.length === 0;
    return reply.status(ready ? 200 : 503).send({
      ok: ready,
      missing,
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
