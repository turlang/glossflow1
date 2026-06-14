import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { publicRoutes } from './public.routes';
import { appointmentRoutes } from './appointments.routes';
import { dashboardRoutes } from './dashboard.routes';
import { adminCrudRoutes } from './admin-crud.routes';
import { businessRoutes } from './business.routes';
import { securityRoutes } from './security.routes';
import { observabilityRoutes } from './observability.routes';
import { integrationsRoutes } from './integrations.routes';
import { writeAuditLog } from './audit';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';

/**
 * Composição central das rotas.
 * As rotas públicas ficam abertas; rotas administrativas recebem autenticação e RBAC.
 */
export async function appRoutes(app: FastifyInstance) {
  app.register(authRoutes);
  app.register(publicRoutes);
  app.register(appointmentRoutes);

  app.register(async (admin) => {
    admin.addHook('preHandler', ensureAuthenticated);
    admin.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']));
    admin.addHook('onResponse', writeAuditLog);
    admin.register(dashboardRoutes);
    admin.register(adminCrudRoutes);
    admin.register(businessRoutes);
    admin.register(securityRoutes);
    admin.register(observabilityRoutes);
    admin.register(integrationsRoutes);
  });
}
