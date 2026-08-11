import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { answerBusinessQuestion, buildBusinessInsights } from '../../services/business-intelligence.service';
import { getTenant } from '../helpers';
import { businessAdminOrReception } from './access';

/** Assistente executivo e insights; regras e providers ficam no serviço. */
export async function businessAiRoutes(app: FastifyInstance) {
  app.post('/admin/ai/assistant', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    const { question } = z.object({ question: z.string().min(3).max(500) }).parse(request.body);
    return answerBusinessQuestion(tenant.salonId, question);
  });

  app.get('/admin/insights', businessAdminOrReception, async (request) => {
    const tenant = getTenant(request);
    return buildBusinessInsights(tenant.salonId);
  });
}
