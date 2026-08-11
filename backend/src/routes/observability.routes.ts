import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { getMetricsSnapshot } from './metrics';

/** Observabilidade administrativa com delegates corporativos obrigatórios. */
export async function observabilityRoutes(app: FastifyInstance) {
  app.get('/admin/observability/overview', async (request) => {
    const tenant = getTenant(request);
    const metrics = getMetricsSnapshot();

    const [auditCount, backupCount, activeSessions, appointments, financialEntries] = await Promise.all([
      prisma.auditLog.count({ where: { salonId: tenant.salonId } }),
      prisma.backupJob.count({ where: { salonId: tenant.salonId } }),
      prisma.userSession.count({ where: { salonId: tenant.salonId, revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.appointment.count({ where: { salonId: tenant.salonId } }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId } })
    ]);

    const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expenses = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
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
      corporateModelsReady: true,
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
