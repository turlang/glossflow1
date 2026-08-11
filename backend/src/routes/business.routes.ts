import { FastifyInstance } from 'fastify';
import { businessAiRoutes } from './business/ai.routes';
import { businessClientRoutes } from './business/clients.routes';
import { businessCommissionRoutes } from './business/commissions.routes';
import { businessFinancialRoutes } from './business/financial.routes';
import { businessLoyaltyRoutes } from './business/loyalty.routes';
import { businessSubscriptionRoutes } from './business/subscription.routes';
import { businessWhatsappTemplateRoutes } from './business/whatsapp-templates.routes';

/**
 * Agregador do domínio comercial. Cada submódulo preserva as URLs públicas
 * existentes e aplica isolamento por tenant no ponto de acesso aos dados.
 */
export async function businessRoutes(app: FastifyInstance) {
  app.register(businessClientRoutes);
  app.register(businessFinancialRoutes);
  app.register(businessCommissionRoutes);
  app.register(businessLoyaltyRoutes);
  app.register(businessSubscriptionRoutes);
  app.register(businessWhatsappTemplateRoutes);
  app.register(businessAiRoutes);
}
