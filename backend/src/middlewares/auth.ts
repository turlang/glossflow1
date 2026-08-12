import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthContext } from '../routes/helpers';
import { prisma } from '../lib/prisma';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET obrigatório em produção.');
  }

  return secret || 'glossflow-local-development-secret';
}

async function resolveSessionBoundContext(payload: AuthContext) {
  if (!payload.sessionId || !payload.id || !payload.salonId) return null;

  const session = await prisma.userSession.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.id,
      salonId: payload.salonId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      user: {
        select: { id: true, email: true, role: true, salonId: true, active: true }
      }
    }
  });

  if (!session?.user?.active) return null;
  if (session.user.salonId !== session.salonId) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    salonId: session.user.salonId,
    sessionId: session.id
  } satisfies AuthContext;
}

/**
 * Autenticação JWT com sessão revogável.
 *
 * Em produção, todo access token novo é vinculado a uma UserSession ativa.
 * Assim revogação, desativação ou alteração de papel deixam de depender do TTL
 * do JWT. Tokens legados continuam aceitos somente fora de produção para manter
 * testes/migração local compatíveis.
 */
export async function ensureAuthenticated(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Token de acesso não informado.' });
  }

  try {
    const accessToken = authorization.replace('Bearer ', '');
    const payload = jwt.verify(accessToken, resolveJwtSecret()) as AuthContext;

    if (payload.sessionId) {
      const current = await resolveSessionBoundContext(payload);
      if (!current) {
        return reply.status(401).send({ message: 'Sessão expirada, revogada ou usuário inativo.' });
      }
      (request as FastifyRequest & { user?: AuthContext }).user = current;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      return reply.status(401).send({
        message: 'Sessão antiga detectada. Renove a sessão ou faça login novamente.'
      });
    }

    /** Compatibilidade restrita a desenvolvimento/testes para JWTs legados. */
    if (!payload.salonId && payload.id) {
      const persistedUser = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, role: true, salonId: true, active: true }
      });

      if (!persistedUser?.active) {
        return reply.status(401).send({ message: 'Usuário inativo ou não encontrado.' });
      }

      payload.id = persistedUser.id;
      payload.email = persistedUser.email;
      payload.role = persistedUser.role;
      payload.salonId = persistedUser.salonId;
    }

    if (!payload.salonId) {
      return reply.status(401).send({
        message: 'Sessão administrativa sem contexto de salão. Faça login novamente.'
      });
    }

    (request as FastifyRequest & { user?: AuthContext }).user = payload;
  } catch {
    return reply.status(401).send({ message: 'Token inválido ou expirado.' });
  }
}

export function requireRoles(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as FastifyRequest & { user?: AuthContext }).user;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ message: 'Permissão insuficiente para esta operação.' });
    }
  };
}
