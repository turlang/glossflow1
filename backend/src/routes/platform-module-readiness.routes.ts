import { FastifyInstance } from 'fastify';
import { getModuleReadinessCatalog, getModuleReadinessSummary } from '../services/module-readiness.service';

/**
 * Marco 35 — inventário operacional dos módulos do produto.
 *
 * A rota é registrada dentro do escopo SUPER_ADMIN em appRoutes, portanto
 * não expõe a maturidade interna do produto em superfícies públicas/tenant.
 */
export async function platformModuleReadinessRoutes(app: FastifyInstance) {
  app.get('/platform-admin/modules/readiness', async () => ({
    summary: getModuleReadinessSummary(),
    modules: getModuleReadinessCatalog()
  }));
}
