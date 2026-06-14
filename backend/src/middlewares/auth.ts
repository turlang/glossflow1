import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthContext } from '../routes/helpers';
import { prisma } from '../lib/prisma';

/**
 * Autenticação JWT com RBAC básico.
 * O payload carrega salonId para isolar dados entre salões diferentes.
 */
export async function ensureAuthenticated(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Token de acesso não informado.' });
  }

  try {
    const token = authorization.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'glossflow-dev-secret') as AuthContext;

    /**
     * Compatibilidade acadêmica para versões anteriores do projeto:
     * alguns tokens antigos possuíam id/e-mail/role, mas não carregavam salonId.
     * Quando isso ocorrer em ambiente local, buscamos o usuário no banco e
     * hidratamos o contexto multiempresa antes das rotas administrativas.
     */
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
