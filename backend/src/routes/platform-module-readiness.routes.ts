import { FastifyInstance } from 'fastify';
import { getModuleReadinessCatalog, getModuleReadinessSummary } from '../services/module-readiness.service';

/**
 * Marco 36 — visão read-only da maturidade dos módulos para SUPER_ADMIN.
 *
 * Esta rota deve ser registrada somente dentro do wrapper platformAdmin em
 * appRoutes.ts, que aplica autenticação, rate limit, SUPER_ADMIN e auditoria.
 */
export async function platformModuleReadinessRoutes(app: FastifyInstance) {
  app.get('/platform-admin/modules/readiness', async () => ({
    summary: getModuleReadinessSummary(),
    modules: getModuleReadinessCatalog()
  }));
}
