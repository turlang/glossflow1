import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { publicRoutes } from './public.routes';
import { appointmentRoutes } from './appointments.routes';
import { whatsappWebhookRoutes } from './whatsapp-webhook.routes';
import { twilioWhatsAppWebhookRoutes } from './twilio-whatsapp-webhook.routes';
import { dashboardRoutes } from './dashboard.routes';
import { adminCrudRoutes } from './admin-crud.routes';
import { inventoryOperationsRoutes } from './inventory-operations.routes';
import { professionalScheduleRoutes } from './professional-schedule.routes';
import { operationalAgendaRoutes } from './operational-agenda.routes';
import { tenantRoutes } from './tenant.routes';
import { businessRoutes } from './business.routes';
import { whatsappAgentRoutes } from './whatsapp-agent.routes';
import { whatsappOperationsRoutes } from './whatsapp-operations.routes';
import { securityRoutes } from './security.routes';
import { platformRoutes } from './platform.routes';
import { platformAdminRoutes } from './platform-admin.routes';
import { platformMaintenanceRoutes } from './platform-maintenance.routes';
import { platformLifecycleRoutes } from './platform-lifecycle.routes';
import { platformSiteRoutes } from './platform-site.routes';
import { platformCostRoutes } from './platform-cost.routes';
import { platformModuleReadinessRoutes } from './platform-module-readiness.routes';
import { observabilityRoutes } from './observability.routes';
import { commercialRoutes } from './commercial.routes';
import { analyticsRoutes } from './analytics.routes';
import { growthRoutes } from './growth.routes';
import { clientPortalPublicRoutes, operationsSuiteRoutes } from './operations-suite.routes';
import { organizationNetworkRoutes } from './organization-network.routes';
import { transactionalHomologationRoutes } from './transactional-homologation.routes';
import { operationalHomologationRoutes } from './operational-homologation.routes';
import { evolutionHardeningRoutes } from './evolution-hardening.routes';
import { appointmentCheckoutRoutes } from './appointment-checkout.routes';
import { enforceMarco35Etapa6BusinessRules, validationHardeningRoutes } from './validation-hardening.routes';
import { writeAuditLog } from './audit';
import { ensureAuthenticated, requireRoles } from '../middlewares/auth';
import { enforceTenantRateLimit } from '../middlewares/rate-limit';
import { enforceTenantSubscriptionAccess } from '../middlewares/subscription-access';
import { enforceSalonModuleAccess } from '../services/module-access.service';

export async function appRoutes(app: FastifyInstance) {
  app.register(platformRoutes);
  app.register(commercialRoutes);
  app.register(authRoutes);
  app.register(publicRoutes);
  app.register(appointmentRoutes);
  app.register(whatsappWebhookRoutes);
  app.register(twilioWhatsAppWebhookRoutes);
  app.register(clientPortalPublicRoutes);

  app.register(async (platformAdmin) => {
    platformAdmin.addHook('preHandler', ensureAuthenticated);
    platformAdmin.addHook('preHandler', enforceTenantRateLimit);
    platformAdmin.addHook('preHandler', requireRoles(['SUPER_ADMIN']));
    platformAdmin.addHook('onResponse', writeAuditLog);
    platformAdmin.register(platformAdminRoutes);
    platformAdmin.register(platformLifecycleRoutes);
    platformAdmin.register(platformSiteRoutes);
    platformAdmin.register(platformCostRoutes);
    platformAdmin.register(platformModuleReadinessRoutes);
    platformAdmin.register(observabilityRoutes);
  });

  app.register(async (platformMaintenance) => {
    platformMaintenance.addHook('preHandler', ensureAuthenticated);
    platformMaintenance.addHook('preHandler', enforceTenantRateLimit);
    platformMaintenance.addHook('preHandler', requireRoles(['SUPER_ADMIN']));
    platformMaintenance.register(platformMaintenanceRoutes);
  });

  app.register(async (operational) => {
    operational.addHook('preHandler', ensureAuthenticated);
    operational.addHook('preHandler', enforceTenantRateLimit);
    operational.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']));
    operational.addHook('preHandler', enforceTenantSubscriptionAccess);
    operational.addHook('preHandler', async (request, reply) => {
      const path = request.url.split('?')[0];
      if (request.method === 'PUT' && path === '/admin/salon') return reply.status(403).send({ code: 'PLATFORM_MANAGED_SETTING', message: 'Site & Marca é configurado exclusivamente pelo Super Admin da plataforma.' });
    });
    operational.addHook('preHandler', enforceSalonModuleAccess);
    operational.addHook('onResponse', writeAuditLog);
    operational.register(dashboardRoutes);
    operational.register(adminCrudRoutes);
    operational.register(inventoryOperationsRoutes);
    operational.register(professionalScheduleRoutes);
    operational.register(operationalAgendaRoutes);
    operational.register(tenantRoutes);
  });

  app.register(async (business) => {
    business.addHook('preHandler', ensureAuthenticated);
    business.addHook('preHandler', enforceTenantRateLimit);
    business.addHook('preHandler', requireRoles(['ADMIN', 'RECEPTION']));
    business.addHook('preHandler', enforceTenantSubscriptionAccess);
    business.addHook('preHandler', async (request, reply) => {
      const path = request.url.split('?')[0];
      if (path.startsWith('/admin/saas/')) return reply.status(410).send({ message: 'Rota administrativa global migrada para o Super Admin da plataforma.' });
      if ((request.method === 'POST' && path === '/admin/subscription/plans') || (request.method === 'PUT' && path === '/admin/subscription')) return reply.status(403).send({ message: 'Planos e assinaturas são gerenciados exclusivamente pelo Super Admin.' });
      if (request.method === 'POST' && path === '/admin/organizations/locations') {
        return reply.status(410).send({
          code: 'CONSENT_REQUIRED',
          message: 'Vínculo direto de unidade desativado. Gere um convite e aceite-o como ADMIN da unidade de destino.'
        });
      }
    });
    business.addHook('preHandler', enforceSalonModuleAccess);
    business.addHook('preHandler', enforceMarco35Etapa6BusinessRules);
    business.addHook('onResponse', writeAuditLog);
    business.register(businessRoutes);
    business.register(analyticsRoutes);
    business.register(growthRoutes);
    business.register(whatsappAgentRoutes);
    business.register(whatsappOperationsRoutes);
    business.register(organizationNetworkRoutes);
    business.register(operationsSuiteRoutes);
    business.register(transactionalHomologationRoutes);
    business.register(operationalHomologationRoutes);
    business.register(evolutionHardeningRoutes);
    business.register(appointmentCheckoutRoutes);
    business.register(validationHardeningRoutes);
  });

  app.register(async (criticalAdmin) => {
    criticalAdmin.addHook('preHandler', ensureAuthenticated);
    criticalAdmin.addHook('preHandler', enforceTenantRateLimit);
    criticalAdmin.addHook('preHandler', requireRoles(['ADMIN']));
    criticalAdmin.addHook('preHandler', enforceTenantSubscriptionAccess);
    criticalAdmin.addHook('preHandler', enforceSalonModuleAccess);
    criticalAdmin.addHook('onResponse', writeAuditLog);
    criticalAdmin.register(securityRoutes);
  });
}
