import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthContext } from '../routes/helpers';
import { getTenantSubscriptionAccess } from '../services/saas-lifecycle.service';

function deniedMessage(code: string) {
  if (code === 'TRIAL_EXPIRED') return 'O período de avaliação deste salão terminou. Fale com o responsável pelo plano GlossFlow.';
  if (code === 'PAST_DUE_BLOCKED') return 'O acesso operacional está temporariamente bloqueado por pendência da assinatura.';
  return 'A assinatura deste salão está cancelada. Fale com o responsável pelo plano GlossFlow.';
}

/**
 * Bloqueia imediatamente operação autenticada quando o contrato do tenant não
 * permite uso. Tenants legados sem SalonSubscription continuam funcionando até
 * serem migrados pelo Super Admin, evitando quebra de compatibilidade.
 */
export async function enforceTenantSubscriptionAccess(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId || user.role === 'SUPER_ADMIN') return;

  const access = await getTenantSubscriptionAccess(user.salonId);
  if (access.allowed) return;

  return reply.status(403).send({
    message: deniedMessage(access.code),
    code: access.code,
    subscriptionStatus: access.status,
    endsAt: access.endsAt
  });
}
