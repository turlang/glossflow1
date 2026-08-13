import { Prisma } from '@prisma/client';

/**
 * MongoDB diferencia um campo explicitamente `null` de um campo ausente.
 * Sessões criadas antes deste hotfix podem não possuir `revokedAt`, enquanto
 * sessões novas passam a gravá-lo explicitamente como null.
 *
 * Este filtro mantém os dois formatos válidos como "não revogado" durante a
 * migração natural dos registros, sem reativar sessões que já possuem data de
 * revogação.
 */
export function notRevokedUserSessionWhere(): Prisma.UserSessionWhereInput {
  return {
    OR: [
      { revokedAt: null },
      { revokedAt: { isSet: false } }
    ]
  };
}

/** Sessão utilizável = não revogada e ainda dentro do prazo de refresh. */
export function activeUserSessionWhere(now = new Date()): Prisma.UserSessionWhereInput {
  return {
    ...notRevokedUserSessionWhere(),
    expiresAt: { gt: now }
  };
}
