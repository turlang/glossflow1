require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'ci-test-secret-with-more-than-thirty-two-characters';
process.env.DEFAULT_PUBLIC_SALON_SLUG = 'glossflow';
process.env.OBSERVABILITY_SLOW_REQUEST_MS = '100';

const { buildApp } = require('../src/app.ts');
const {
  getMetricsSnapshot,
  getPrometheusMetrics,
  normalizeMetricPath,
  recordDependencyMetric,
  recordMetric,
  resetMetricsForTests
} = require('../src/routes/metrics.ts');
const { criticalMongoIndexes } = require('../src/services/database-indexes.service.ts');

test('normaliza IDs dinâmicos antes de agregar métricas de rota', () => {
  assert.equal(
    normalizeMetricPath('/admin/clients/507f1f77bcf86cd799439013/history?limit=20'),
    '/admin/clients/:id/history'
  );
  assert.equal(
    normalizeMetricPath('/webhooks/jobs/123456/status'),
    '/webhooks/jobs/:id/status'
  );
});

test('snapshot calcula percentis, erro e requisições lentas em janela bounded', () => {
  resetMetricsForTests();
  for (const latency of [10, 20, 30, 40, 100]) {
    recordMetric({
      method: 'GET',
      path: '/health',
      statusCode: latency === 100 ? 500 : 200,
      responseTimeMs: latency,
      createdAt: new Date().toISOString()
    });
  }

  const snapshot = getMetricsSnapshot();
  assert.equal(snapshot.totalRequests, 5);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.errorRatePct, 20);
  assert.equal(snapshot.latency.p50Ms, 30);
  assert.equal(snapshot.latency.p95Ms, 100);
  assert.equal(snapshot.slowRequests, 1);
  assert.equal(snapshot.routes[0].route, 'GET /health');
});

test('dependências registram taxa de sucesso e aparecem na exportação Prometheus', () => {
  resetMetricsForTests();
  recordDependencyMetric({ dependency: 'ai-groq', operation: 'responses', ok: true, latencyMs: 40, statusCode: 200, createdAt: new Date().toISOString() });
  recordDependencyMetric({ dependency: 'ai-groq', operation: 'responses', ok: false, latencyMs: 120, statusCode: 503, errorCode: 'UPSTREAM_503', createdAt: new Date().toISOString() });

  const dependency = getMetricsSnapshot().dependencies[0];
  assert.equal(dependency.dependency, 'ai-groq');
  assert.equal(dependency.count, 2);
  assert.equal(dependency.failures, 1);
  assert.equal(dependency.successRatePct, 50);

  const prometheus = getPrometheusMetrics();
  assert.match(prometheus, /glossflow_dependency_failures\{dependency="ai-groq",operation="responses"\} 1/);
  assert.match(prometheus, /glossflow_dependency_latency_p95_ms/);
});

test('HTTP expõe request id, build id e registra a rota depois da resposta', async () => {
  resetMetricsForTests();
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-request-id']);

    const body = response.json();
    assert.equal(typeof body.build, 'string');
    assert.ok(body.build.length > 0);
    assert.equal(response.headers['x-glossflow-build'], body.build);

    const snapshot = getMetricsSnapshot();
    assert.equal(snapshot.totalRequests, 1);
    assert.equal(snapshot.routes[0].route, 'GET /health');
    assert.equal(snapshot.activeRequests, 0);
  } finally {
    await app.close();
  }
});

test('observabilidade global exige autenticação de plataforma antes de consultar dados', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/platform-admin/observability/overview' });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('plano de índices cobre Agenda, sessões, CRM, estoque e auditoria', () => {
  const byCollection = Object.fromEntries(criticalMongoIndexes.map((group) => [group.collection, group.indexes]));
  assert.ok(byCollection.Appointment.some((item) => item.name === 'idx_appointment_salon_professional_start'));
  assert.ok(byCollection.UserSession.some((item) => item.name === 'idx_session_salon_active_expiry'));
  assert.ok(byCollection.Client.some((item) => item.name === 'idx_client_salon_phone'));
  assert.ok(byCollection.InventoryMovement.some((item) => item.name === 'idx_inventory_movement_salon_product_created'));
  assert.ok(byCollection.AuditLog.some((item) => item.name === 'idx_audit_salon_created'));
});
