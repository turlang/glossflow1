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

export function getPrometheusMetrics() {
  const snapshot = getMetricsSnapshot();
  const lines = [
    '# HELP glossflow_uptime_seconds Tempo de atividade da API em segundos.',
    '# TYPE glossflow_uptime_seconds gauge',
    `glossflow_uptime_seconds ${snapshot.uptimeSeconds}`,
    '# HELP glossflow_http_requests_total Total de requisições medidas em memória.',
    '# TYPE glossflow_http_requests_total counter',
    `glossflow_http_requests_total ${snapshot.totalRequests}`,
    '# HELP glossflow_http_errors_total Total de respostas 5xx medidas em memória.',
    '# TYPE glossflow_http_errors_total counter',
    `glossflow_http_errors_total ${snapshot.errors}`,
    '# HELP glossflow_http_warnings_total Total de respostas 4xx medidas em memória.',
    '# TYPE glossflow_http_warnings_total counter',
    `glossflow_http_warnings_total ${snapshot.warnings}`,
    '# HELP glossflow_http_latency_average_ms Latência média das requisições medidas.',
    '# TYPE glossflow_http_latency_average_ms gauge',
    `glossflow_http_latency_average_ms ${snapshot.averageLatency}`,
    '# HELP glossflow_memory_rss_bytes Memória RSS usada pelo processo Node.',
    '# TYPE glossflow_memory_rss_bytes gauge',
    `glossflow_memory_rss_bytes ${snapshot.memory.rss}`
  ];

  for (const route of snapshot.routes) {
    const safeRoute = route.route.replace(/"/g, '\\"');
    lines.push(`glossflow_route_requests_total{route="${safeRoute}"} ${route.count}`);
    lines.push(`glossflow_route_errors_total{route="${safeRoute}"} ${route.errors}`);
    lines.push(`glossflow_route_latency_average_ms{route="${safeRoute}"} ${route.averageLatency}`);
  }

  return `${lines.join('\n')}\n`;
}
