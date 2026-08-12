/**
 * Observabilidade operacional leve e bounded-memory.
 *
 * O collector fica no processo para não tornar Datadog/Sentry/Prometheus uma
 * dependência obrigatória do GlossFlow. Ele expõe dados suficientes para o
 * Super Admin, /metrics e alertas externos, preservando cardinalidade baixa.
 */
export type MetricSample = {
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  requestId?: string;
  createdAt: string;
};

export type DependencyMetricSample = {
  dependency: string;
  operation: string;
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  errorCode?: string;
  createdAt: string;
};

type RouteAggregate = {
  count: number;
  errors: number;
  warnings: number;
  latency: number[];
};

type DependencyAggregate = {
  count: number;
  failures: number;
  latency: number[];
};

const samples: MetricSample[] = [];
const dependencySamples: DependencyMetricSample[] = [];
const MAX_HTTP_SAMPLES = 1_000;
const MAX_DEPENDENCY_SAMPLES = 500;
const startedAt = new Date();
let activeRequests = 0;

function boundedPush<T>(target: T[], value: T, limit: number) {
  target.push(value);
  if (target.length > limit) target.splice(0, target.length - limit);
}

export function normalizeMetricPath(path: string) {
  const clean = String(path || '/').split('?')[0] || '/';
  return clean
    .split('/')
    .map((segment) => {
      if (/^[a-f\d]{24}$/i.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return ':id';
      if (/^\d{4,}$/.test(segment)) return ':id';
      return segment;
    })
    .join('/') || '/';
}

export function markRequestStarted() {
  activeRequests += 1;
}

export function recordMetric(sample: MetricSample) {
  activeRequests = Math.max(0, activeRequests - 1);
  boundedPush(samples, {
    ...sample,
    method: String(sample.method || 'GET').toUpperCase(),
    path: normalizeMetricPath(sample.path),
    responseTimeMs: Math.max(0, Math.round(sample.responseTimeMs || 0))
  }, MAX_HTTP_SAMPLES);
}

export function recordDependencyMetric(sample: DependencyMetricSample) {
  boundedPush(dependencySamples, {
    ...sample,
    dependency: String(sample.dependency || 'unknown').toLowerCase(),
    operation: String(sample.operation || 'request').toLowerCase(),
    latencyMs: Math.max(0, Math.round(sample.latencyMs || 0)),
    errorCode: sample.errorCode ? String(sample.errorCode).slice(0, 80) : undefined
  }, MAX_DEPENDENCY_SAMPLES);
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return Math.round(sorted[index]);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarizeLatency(values: number[]) {
  return {
    averageMs: average(values),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
    maxMs: values.length ? Math.round(Math.max(...values)) : 0
  };
}

export function getMetricsSnapshot() {
  const totalRequests = samples.length;
  const errors = samples.filter((sample) => sample.statusCode >= 500).length;
  const warnings = samples.filter((sample) => sample.statusCode >= 400 && sample.statusCode < 500).length;
  const latencies = samples.map((sample) => sample.responseTimeMs);
  const latency = summarizeLatency(latencies);
  const slowThresholdMs = Math.max(100, Number(process.env.OBSERVABILITY_SLOW_REQUEST_MS || 750));

  const byRoute = samples.reduce<Record<string, RouteAggregate>>((acc, sample) => {
    const key = `${sample.method} ${sample.path}`;
    acc[key] = acc[key] || { count: 0, errors: 0, warnings: 0, latency: [] };
    acc[key].count += 1;
    acc[key].latency.push(sample.responseTimeMs);
    if (sample.statusCode >= 500) acc[key].errors += 1;
    if (sample.statusCode >= 400 && sample.statusCode < 500) acc[key].warnings += 1;
    return acc;
  }, {});

  const routes = Object.entries(byRoute)
    .map(([route, data]) => ({
      route,
      count: data.count,
      errors: data.errors,
      warnings: data.warnings,
      errorRatePct: data.count ? Number(((data.errors / data.count) * 100).toFixed(2)) : 0,
      ...summarizeLatency(data.latency)
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms || b.count - a.count)
    .slice(0, 25);

  const dependencyGroups = dependencySamples.reduce<Record<string, DependencyAggregate>>((acc, sample) => {
    const key = `${sample.dependency}:${sample.operation}`;
    acc[key] = acc[key] || { count: 0, failures: 0, latency: [] };
    acc[key].count += 1;
    acc[key].latency.push(sample.latencyMs);
    if (!sample.ok) acc[key].failures += 1;
    return acc;
  }, {});

  const dependencies = Object.entries(dependencyGroups)
    .map(([key, data]) => {
      const separator = key.indexOf(':');
      const dependency = separator >= 0 ? key.slice(0, separator) : key;
      const operation = separator >= 0 ? key.slice(separator + 1) : 'request';
      return {
        dependency,
        operation,
        count: data.count,
        failures: data.failures,
        successRatePct: data.count ? Number((((data.count - data.failures) / data.count) * 100).toFixed(2)) : 100,
        ...summarizeLatency(data.latency)
      };
    })
    .sort((a, b) => b.failures - a.failures || b.p95Ms - a.p95Ms);

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    activeRequests,
    totalRequests,
    errors,
    warnings,
    errorRatePct: totalRequests ? Number(((errors / totalRequests) * 100).toFixed(2)) : 0,
    averageLatency: latency.averageMs,
    latency,
    slowThresholdMs,
    slowRequests: samples.filter((sample) => sample.responseTimeMs >= slowThresholdMs).length,
    memory: process.memoryUsage(),
    recent: [...samples].slice(-50).reverse(),
    recentErrors: [...samples].filter((sample) => sample.statusCode >= 500).slice(-30).reverse(),
    routes,
    dependencies,
    recentDependencyFailures: [...dependencySamples].filter((sample) => !sample.ok).slice(-30).reverse()
  };
}

function prometheusLabel(value: string) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function getPrometheusMetrics() {
  const snapshot = getMetricsSnapshot();
  const lines = [
    '# HELP glossflow_uptime_seconds Tempo de atividade da API em segundos.',
    '# TYPE glossflow_uptime_seconds gauge',
    `glossflow_uptime_seconds ${snapshot.uptimeSeconds}`,
    '# HELP glossflow_http_active_requests Requisicoes atualmente em processamento.',
    '# TYPE glossflow_http_active_requests gauge',
    `glossflow_http_active_requests ${snapshot.activeRequests}`,
    '# HELP glossflow_http_requests_total Requisicoes presentes na janela bounded-memory.',
    '# TYPE glossflow_http_requests_total gauge',
    `glossflow_http_requests_total ${snapshot.totalRequests}`,
    '# HELP glossflow_http_errors_total Respostas 5xx presentes na janela.',
    '# TYPE glossflow_http_errors_total gauge',
    `glossflow_http_errors_total ${snapshot.errors}`,
    '# HELP glossflow_http_latency_p95_ms Latencia p95 na janela atual.',
    '# TYPE glossflow_http_latency_p95_ms gauge',
    `glossflow_http_latency_p95_ms ${snapshot.latency.p95Ms}`,
    '# HELP glossflow_http_latency_p99_ms Latencia p99 na janela atual.',
    '# TYPE glossflow_http_latency_p99_ms gauge',
    `glossflow_http_latency_p99_ms ${snapshot.latency.p99Ms}`,
    '# HELP glossflow_memory_rss_bytes Memoria RSS usada pelo processo Node.',
    '# TYPE glossflow_memory_rss_bytes gauge',
    `glossflow_memory_rss_bytes ${snapshot.memory.rss}`
  ];

  for (const route of snapshot.routes) {
    const routeLabel = prometheusLabel(route.route);
    lines.push(`glossflow_route_requests{route="${routeLabel}"} ${route.count}`);
    lines.push(`glossflow_route_errors{route="${routeLabel}"} ${route.errors}`);
    lines.push(`glossflow_route_latency_p95_ms{route="${routeLabel}"} ${route.p95Ms}`);
  }

  for (const dependency of snapshot.dependencies) {
    const dependencyLabel = prometheusLabel(dependency.dependency);
    const operationLabel = prometheusLabel(dependency.operation);
    lines.push(`glossflow_dependency_requests{dependency="${dependencyLabel}",operation="${operationLabel}"} ${dependency.count}`);
    lines.push(`glossflow_dependency_failures{dependency="${dependencyLabel}",operation="${operationLabel}"} ${dependency.failures}`);
    lines.push(`glossflow_dependency_latency_p95_ms{dependency="${dependencyLabel}",operation="${operationLabel}"} ${dependency.p95Ms}`);
  }

  return `${lines.join('\n')}\n`;
}

/** Usado somente por testes determinísticos. */
export function resetMetricsForTests() {
  samples.splice(0, samples.length);
  dependencySamples.splice(0, dependencySamples.length);
  activeRequests = 0;
}
