import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getAIRuntimeConfig } from '../services/ai-provider.service';
import { whatsappRuntimeDiagnostics } from '../services/whatsapp.service';
import { getMetricsSnapshot } from './metrics';

async function probeDatabase() {
  const startedAt = Date.now();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function observabilityThresholds() {
  return {
    p95LatencyMs: Math.max(100, Number(process.env.OBSERVABILITY_SLO_P95_MS || 750)),
    errorRatePct: Math.max(0.1, Number(process.env.OBSERVABILITY_SLO_ERROR_RATE_PCT || 2)),
    dependencySuccessRatePct: Math.min(100, Math.max(0, Number(process.env.OBSERVABILITY_DEPENDENCY_SUCCESS_RATE_PCT || 98)))
  };
}

/**
 * Visão global de operação exclusiva do SUPER_ADMIN.
 * Não expõe tokens, DSNs, credenciais de provider nem payloads de clientes.
 */
export async function observabilityRoutes(app: FastifyInstance) {
  app.get('/platform-admin/observability/overview', async () => {
    const metrics = getMetricsSnapshot();
    const thresholds = observabilityThresholds();
    const database = await probeDatabase();

    const [salons, activeSubscriptions, activeSessions, auditEvents, backupJobs] = await Promise.all([
      prisma.salon.count(),
      prisma.salonSubscription.count({ where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } } }),
      prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.auditLog.count(),
      prisma.backupJob.count()
    ]);

    const dependencyFailures = metrics.dependencies.filter((item) => item.successRatePct < thresholds.dependencySuccessRatePct);
    const alerts = [
      ...(!database.ok ? [{ level: 'critical', code: 'DATABASE_UNAVAILABLE', message: 'MongoDB não respondeu ao probe de readiness.' }] : []),
      ...(metrics.latency.p95Ms > thresholds.p95LatencyMs
        ? [{ level: 'warning', code: 'HTTP_P95_HIGH', message: `Latência p95 em ${metrics.latency.p95Ms}ms, acima do SLO de ${thresholds.p95LatencyMs}ms.` }]
        : []),
      ...(metrics.errorRatePct > thresholds.errorRatePct
        ? [{ level: 'critical', code: 'HTTP_ERROR_RATE_HIGH', message: `Taxa 5xx em ${metrics.errorRatePct}%, acima do SLO de ${thresholds.errorRatePct}%.` }]
        : []),
      ...dependencyFailures.map((dependency) => ({
        level: 'warning',
        code: 'DEPENDENCY_DEGRADED',
        message: `${dependency.dependency}/${dependency.operation} com sucesso de ${dependency.successRatePct}%.`
      }))
    ];

    const penalty = (database.ok ? 0 : 35)
      + Math.max(0, metrics.errorRatePct - thresholds.errorRatePct) * 4
      + Math.max(0, metrics.latency.p95Ms - thresholds.p95LatencyMs) / 40
      + dependencyFailures.length * 5;
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    const ai = getAIRuntimeConfig();
    const whatsapp = whatsappRuntimeDiagnostics();

    return {
      healthScore,
      serviceStatus: alerts.some((item) => item.level === 'critical')
        ? 'Crítico'
        : alerts.length
          ? 'Atenção'
          : 'Operacional',
      checkedAt: new Date().toISOString(),
      thresholds,
      database,
      http: {
        uptimeSeconds: metrics.uptimeSeconds,
        activeRequests: metrics.activeRequests,
        totalRequests: metrics.totalRequests,
        errors: metrics.errors,
        warnings: metrics.warnings,
        errorRatePct: metrics.errorRatePct,
        latency: metrics.latency,
        slowThresholdMs: metrics.slowThresholdMs,
        slowRequests: metrics.slowRequests,
        routes: metrics.routes,
        recentErrors: metrics.recentErrors
      },
      process: {
        rssMb: Math.round(metrics.memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(metrics.memory.heapTotal / 1024 / 1024)
      },
      platform: {
        salons,
        activeSubscriptions,
        activeSessions,
        auditEvents,
        backupJobs
      },
      dependencies: metrics.dependencies,
      recentDependencyFailures: metrics.recentDependencyFailures,
      providers: {
        ai: {
          provider: ai.provider,
          model: ai.model,
          configured: ai.configured
        },
        whatsapp: {
          provider: whatsapp.provider,
          dryRun: whatsapp.dryRun,
          accessTokenConfigured: whatsapp.accessTokenConfigured,
          phoneNumberIdConfigured: whatsapp.phoneNumberIdConfigured,
          twilio: whatsapp.twilio
        }
      },
      alerts,
      recommendations: [
        metrics.latency.p95Ms > thresholds.p95LatencyMs
          ? 'Priorizar as rotas com maior p95 e revisar consultas/índices antes de adicionar cache.'
          : 'Latência p95 dentro do SLO configurado.',
        metrics.errorRatePct > thresholds.errorRatePct
          ? 'Investigar os requestIds em recentErrors e correlacionar com logs do Render.'
          : 'Taxa de erro 5xx dentro do SLO configurado.',
        dependencyFailures.length
          ? 'Verificar providers degradados, credenciais, limites e disponibilidade externa.'
          : 'Dependências medidas sem degradação acima do limite configurado.',
        backupJobs === 0
          ? 'Executar e validar pelo menos um backup antes do release comercial estável.'
          : 'Há evidência de backup registrada na plataforma.'
      ]
    };
  });
}
