import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { getMetricsSnapshot } from './metrics';

const model = (name: string) => (prisma as any)[name];

/**
 * Observabilidade do SaaS.
 * -----------------------------------------------------------------------------
 * Exposição administrativa de saúde, métricas, auditoria resumida e qualidade
 * operacional. Em produção, conecte este módulo a Sentry, OpenTelemetry,
 * Prometheus, Grafana, Datadog ou serviço equivalente.
 */
export async function observabilityRoutes(app: FastifyInstance) {
  app.get('/admin/observability/overview', async (request) => {
    const tenant = getTenant(request);
    const metrics = getMetricsSnapshot();

    const auditModel = model('auditLog');
    const backupModel = model('backupJob');
    const sessionModel = model('userSession');

    const [auditCount, backupCount, activeSessions, appointments, financialEntries] = await Promise.all([
      auditModel?.count ? auditModel.count({ where: { salonId: tenant.salonId } }) : 0,
      backupModel?.count ? backupModel.count({ where: { salonId: tenant.salonId } }) : 0,
      sessionModel?.count ? sessionModel.count({ where: { salonId: tenant.salonId, revokedAt: null, expiresAt: { gt: new Date() } } }) : 0,
      prisma.appointment.count({ where: { salonId: tenant.salonId } }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId } })
    ]);

    const revenue = financialEntries.filter((entry: any) => entry.type === 'REVENUE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const expenses = financialEntries.filter((entry: any) => entry.type === 'EXPENSE').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
    const errorRate = metrics.totalRequests ? Math.round((metrics.errors / metrics.totalRequests) * 100) : 0;
    const healthScore = Math.max(60, Math.min(99, 98 - errorRate - Math.max(0, metrics.averageLatency - 350) / 25));

    return {
      healthScore: Math.round(healthScore),
      serviceStatus: metrics.errors ? 'Atenção' : 'Operacional',
      uptimeSeconds: metrics.uptimeSeconds,
      averageLatency: metrics.averageLatency,
      totalRequests: metrics.totalRequests,
      errorRate,
      memoryMb: Math.round(metrics.memory.rss / 1024 / 1024),
      auditCount,
      backupCount,
      activeSessions,
      corporateModelsReady: Boolean(auditModel && backupModel && sessionModel),
      businessSignals: { appointments, revenue, expenses, profit: revenue - expenses },
      routes: metrics.routes,
      recent: metrics.recent,
      recommendations: [
        metrics.averageLatency > 500 ? 'Investigar endpoints acima de 500ms e adicionar cache.' : 'Latência média saudável para operação piloto.',
        errorRate > 2 ? 'Revisar erros recentes e configurar alerta externo.' : 'Taxa de erro dentro do esperado.',
        backupCount === 0 ? 'Criar primeiro backup lógico e agendar rotina automática.' : 'Rotina de backup registrada no sistema.',
        'Para produção: conectar Sentry, logs centralizados e monitoramento de banco.'
      ]
    };
  });
}
