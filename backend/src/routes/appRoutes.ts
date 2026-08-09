import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
import { commercialRoutes } from './commercial.routes';
import { analyticsRoutes } from './analytics.routes';
import { growthRoutes } from './growth.routes';
import { writeAuditLog } from './audit';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';
import { AuthContext } from './helpers';

/**
 * Separa explicitamente o administrador da plataforma do administrador de salão.
 * - /admin/saas/*: somente SUPER_ADMIN do GlossFlow.
 * - demais rotas deste bloco: somente ADMIN/RECEPTION do salão autenticado.
 */
async function requireBusinessScope(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  const path = request.url.split('?')[0];
  const isPlatformRoute = path.startsWith('/admin/saas/');

  if (isPlatformRoute) {
    if (user?.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ message: 'Acesso exclusivo do Super Admin da plataforma.' });
    }
    return;
  }

  if (!user || !['ADMIN', 'RECEPTION'].includes(user.role)) {
    return reply.status(403).send({ message: 'Permissão insuficiente para esta operação.' });
  }
}

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
  app.register(whatsappWebhookRoutes);

  /**
   * Rotas operacionais de cada salão.
   * Todos os dados continuam isolados pelo salonId carregado no JWT.
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
   * Negócio do salão + administração global SaaS.
   * O hook requireBusinessScope impede qualquer ADMIN de salão de consultar
   * métricas globais, salões ou assinaturas da plataforma.
   */
  app.register(async (business) => {
    business.addHook('preHandler', ensureAuthenticated);
    business.addHook('preHandler', requireBusinessScope);
    business.addHook('onResponse', writeAuditLog);
    business.register(businessRoutes);
    business.register(analyticsRoutes);
    business.register(growthRoutes);
    business.register(whatsappAgentRoutes);
  });

  /**
   * Rotas críticas de um salão.
   * Segurança, observabilidade e integrações do tenant permanecem restritas
   * ao ADMIN daquele salão; SUPER_ADMIN não herda acesso aos dados do cliente.
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
