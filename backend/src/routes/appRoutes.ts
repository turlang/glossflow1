import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { publicRoutes } from './public.routes';
import { appointmentRoutes } from './appointments.routes';
import { whatsappWebhookRoutes } from './whatsapp-webhook.routes';
import { dashboardRoutes } from './dashboard.routes';
import { adminCrudRoutes } from './admin-crud.routes';
import { tenantRoutes } from './tenant.routes';
import { businessRoutes } from './business.routes';
import { whatsappAgentRoutes } from './whatsapp-agent.routes';
import { securityRoutes } from './security.routes';
import { observabilityRoutes } from './observability.routes';
import { integrationsRoutes } from './integrations.routes';
import { platformRoutes } from './platform.routes';
import { platformAdminRoutes } from './platform-admin.routes';
import { commercialRoutes } from './commercial.routes';
import { analyticsRoutes } from './analytics.routes';
import { growthRoutes } from './growth.routes';
import { writeAuditLog } from './audit';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';

/**
 * Composição central das rotas.
 * Existem dois contextos administrativos separados:
 * - SUPER_ADMIN: administração global da plataforma.
 * - ADMIN/RECEPTION/PROFESSIONAL: operação isolada de um salão.
 */
export async function appRoutes(app: FastifyInstance) {
  app.register(platformRoutes);
  app.register(commercialRoutes);
  app.register(authRoutes);
  app.register(publicRoutes);
  app.register(appointmentRoutes);
  app.register(whatsappWebhookRoutes);

  /** Rotas globais do SaaS: somente SUPER_ADMIN. */
  app.register(async (platformAdmin) => {
    platformAdmin.addHook('preHandler', ensureAuthenticated);
    platformAdmin.addHook('preHandler', requireRoles(['SUPER_ADMIN']));
    platformAdmin.addHook('onResponse', writeAuditLog);
    platformAdmin.register(platformAdminRoutes);
  });

  /**
   * Rotas operacionais de cada salão.
   * Todos os dados são filtrados pelo salonId carregado no JWT.
   */
  app.register(async (operational) => {
    operational.addHook('preHandler', ensureAuthenticated);
    operational.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']));
    operational.addHook('onResponse', writeAuditLog);
    operational.register(dashboardRoutes);
    operational.register(adminCrudRoutes);
    operational.register(tenantRoutes);
  });

  /**
   * Negócio, CRM, analytics e agente do salão.
   * As antigas rotas /admin/saas/* ficam explicitamente desativadas para evitar
   * qualquer vazamento entre tenants; a visão global vive em /platform-admin/*.
   */
  app.register(async (business) => {
    business.addHook('preHandler', ensureAuthenticated);
    business.addHook('preHandler', async (request, reply) => {
      if (request.url.split('?')[0].startsWith('/admin/saas/')) {
        return reply.status(410).send({ message: 'Rota administrativa global migrada para o Super Admin da plataforma.' });
      }
    });
    business.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION']));
    business.addHook('onResponse', writeAuditLog);
    business.register(businessRoutes);
    business.register(analyticsRoutes);
    business.register(growthRoutes);
    business.register(whatsappAgentRoutes);
  });

  /** Rotas críticas de um salão: somente ADMIN daquele tenant. */
  app.register(async (criticalAdmin) => {
    criticalAdmin.addHook('preHandler', ensureAuthenticated);
    criticalAdmin.addHook('preHandler', requireRoles(['ADMIN']));
    criticalAdmin.addHook('onResponse', writeAuditLog);
    criticalAdmin.register(securityRoutes);
    criticalAdmin.register(observabilityRoutes);
    criticalAdmin.register(integrationsRoutes);
  });
}
