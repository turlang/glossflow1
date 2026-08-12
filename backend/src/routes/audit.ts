import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { AuthContext } from './helpers';

const SENSITIVE_BODY_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'apiKey',
  'snapshot'
]);

function safeBodyKeys(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>)
    .filter((key) => !SENSITIVE_BODY_KEYS.has(key))
    .sort();
}

/**
 * Registra ações administrativas relevantes sem persistir conteúdo sensível.
 * A auditoria inclui correlação com request/session para resposta a incidentes.
 */
export async function writeAuditLog(request: FastifyRequest, reply: FastifyReply) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId) return;

  const path = request.url.split('?')[0];
  const resource = path.split('/').filter(Boolean).slice(1, 3).join('/') || 'admin';

  prisma.auditLog.create({
    data: {
      action: method,
      resource,
      method,
      path,
      ip: request.ip || '',
      userAgent: String(request.headers['user-agent'] || ''),
      metadata: {
        requestId: String(request.id || ''),
        sessionId: user.sessionId || '',
        statusCode: reply.statusCode,
        outcome: reply.statusCode >= 400 ? 'DENIED_OR_FAILED' : 'SUCCESS',
        bodyKeys: safeBodyKeys(request.body)
      },
      userId: user.id,
      salonId: user.salonId
    }
  }).catch(() => undefined);
}
