/**
 * Métricas operacionais em memória.
 * -----------------------------------------------------------------------------
 * Esta camada entrega observabilidade básica sem exigir Datadog/Sentry/Prometheus
 * em ambiente de MVP. Em produção, estes dados devem ser enviados para uma solução
 * externa centralizada.
 */
export type MetricSample = {
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  createdAt: string;
};

const samples: MetricSample[] = [];
const MAX_SAMPLES = 500;
const startedAt = new Date();

export function recordMetric(sample: MetricSample) {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

export function getMetricsSnapshot() {
  const totalRequests = samples.length;
  const errors = samples.filter((sample) => sample.statusCode >= 500).length;
  const warnings = samples.filter((sample) => sample.statusCode >= 400 && sample.statusCode < 500).length;
  const averageLatency = totalRequests
    ? Math.round(samples.reduce((sum, sample) => sum + sample.responseTimeMs, 0) / totalRequests)
    : 0;

  const byRoute = samples.reduce<Record<string, { count: number; errors: number; totalLatency: number }>>((acc, sample) => {
    const key = `${sample.method} ${sample.path.split('?')[0]}`;
    acc[key] = acc[key] || { count: 0, errors: 0, totalLatency: 0 };
    acc[key].count += 1;
    acc[key].totalLatency += sample.responseTimeMs;
    if (sample.statusCode >= 500) acc[key].errors += 1;
    return acc;
  }, {});

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    totalRequests,
    errors,
    warnings,
    averageLatency,
    memory: process.memoryUsage(),
    recent: [...samples].slice(-40).reverse(),
    routes: Object.entries(byRoute)
      .map(([route, data]) => ({
        route,
        count: data.count,
        errors: data.errors,
        averageLatency: Math.round(data.totalLatency / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  };
}
