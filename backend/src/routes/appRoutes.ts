import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { publicRoutes } from './public.routes';
import { appointmentRoutes } from './appointments.routes';
import { dashboardRoutes } from './dashboard.routes';
import { adminCrudRoutes } from './admin-crud.routes';
import { tenantRoutes } from './tenant.routes';
import { businessRoutes } from './business.routes';
import { securityRoutes } from './security.routes';
import { observabilityRoutes } from './observability.routes';
import { integrationsRoutes } from './integrations.routes';
import { platformRoutes } from './platform.routes';
import { commercialRoutes } from './commercial.routes';
import { analyticsRoutes } from './analytics.routes';
import { growthRoutes } from './growth.routes';
import { writeAuditLog } from './audit';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';

/**
 * Composição central das rotas.
 * As rotas públicas ficam abertas; rotas administrativas recebem autenticação,
 * auditoria e RBAC por nível de risco.
 */
export async function appRoutes(app: FastifyInstance) {
  app.register(platformRoutes);
  app.register(commercialRoutes);
  app.register(authRoutes);
  app.register(publicRoutes);
  app.register(appointmentRoutes);

  /**
   * Rotas operacionais do salão.
   * Profissionais podem acessar apenas o bloco operacional; as rotas internas
   * ainda aplicam permissões específicas quando a ação é sensível.
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
   * Rotas comerciais, CRM e evolução SaaS.
   * Financeiro, comissão, assinatura e Super Admin possuem proteção interna para ADMIN.
   */
  app.register(async (business) => {
    business.addHook('preHandler', ensureAuthenticated);
    business.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION']));
    business.addHook('onResponse', writeAuditLog);
    business.register(businessRoutes);
    business.register(analyticsRoutes);
    business.register(growthRoutes);
  });

  /**
   * Rotas críticas da plataforma.
   * Segurança, observabilidade e integrações ficam restritas ao ADMIN.
   */
  app.register(async (criticalAdmin) => {
    criticalAdmin.addHook('preHandler', ensureAuthenticated);
    criticalAdmin.addHook('preHandler', requireRoles(['ADMIN']));
    criticalAdmin.addHook('onResponse', writeAuditLog);
    criticalAdmin.register(securityRoutes);
    criticalAdmin.register(observabilityRoutes);
    criticalAdmin.register(integrationsRoutes);
  });
}
