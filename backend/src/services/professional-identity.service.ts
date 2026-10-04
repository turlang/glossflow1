import { prisma } from '../lib/prisma';
import { AuthContext } from '../routes/helpers';

/** An explicit tenant-scoped link is required; names and email are not identities. */
export async function professionalIdentity(tenant: AuthContext) {
  const matches = await prisma.professional.findMany({
    where: { salonId: tenant.salonId, userId: tenant.id, active: true },
    select: { id: true }, take: 2
  });
  return matches.length === 1 ? matches[0].id : null;
}
