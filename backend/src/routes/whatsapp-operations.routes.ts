import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getWhatsAppOperationalMetrics } from '../services/whatsapp-agent/metrics.service';
import { customerServiceWindow } from '../services/whatsapp-agent/outbound-policy.service';
import { getTenant } from './helpers';

/** Read models operacionais do Marco 20; autenticação/RBAC são herdados do grupo business. */
export async function whatsappOperationsRoutes(app: FastifyInstance) {
  app.get('/admin/whatsapp/metrics', async (request) => {
    const tenant = getTenant(request);
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).optional().default(30) }).parse(request.query);
    return getWhatsAppOperationalMetrics(tenant.salonId, days);
  });

  app.get('/admin/whatsapp/window/:phone', async (request) => {
    const tenant = getTenant(request);
    const { phone } = z.object({ phone: z.string().min(10).max(30) }).parse(request.params);
    return customerServiceWindow(tenant.salonId, phone);
  });
}
