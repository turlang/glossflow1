import { FastifyReply, FastifyRequest } from 'fastify';
import { getTenant } from '../helpers';

export function requireBusinessRoles(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenant = getTenant(request);
    if (!roles.includes(tenant.role)) {
      return reply.status(403).send({ message: 'Permissão insuficiente para esta operação.' });
    }
  };
}

export const businessAdminOnly = { preHandler: requireBusinessRoles(['ADMIN']) };
export const businessAdminOrReception = { preHandler: requireBusinessRoles(['ADMIN', 'RECEPTION']) };
