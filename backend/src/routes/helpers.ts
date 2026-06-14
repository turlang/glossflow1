import { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';

export type AuthContext = { id: string; role: string; salonId: string; email: string };

/** Recupera o salão público padrão usado pela vitrine demonstrativa. */
export async function getMainSalon() {
  const salon = await prisma.salon.findFirst({ where: { slug: 'glossflow' } });
  if (!salon) throw new Error('Salão padrão não encontrado. Execute npm run seed.');
  return salon;
}

/** Garante isolamento multi-tenant usando salonId do token JWT. */
export function getTenant(request: FastifyRequest) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId) throw new Error('Sessão administrativa sem contexto de salão. Faça login novamente.');
  return user;
}
