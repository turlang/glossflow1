import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { AuthContext } from './helpers';

/** Registra ações administrativas relevantes sem bloquear a resposta da API. */
export async function writeAuditLog(request: FastifyRequest, _reply: FastifyReply) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId) return;

  const auditModel = (prisma as any).auditLog;
  if (!auditModel?.create) return;

  const path = request.url.split('?')[0];
  const resource = path.split('/').filter(Boolean).slice(1, 3).join('/') || 'admin';

  auditModel.create({
    data: {
      action: method,
      resource,
      method,
      path,
      ip: request.ip || '',
      userAgent: String(request.headers['user-agent'] || ''),
      metadata: { bodyKeys: request.body && typeof request.body === 'object' ? Object.keys(request.body as object) : [] },
      userId: user.id,
      salonId: user.salonId
    }
  }).catch(() => undefined);
}
