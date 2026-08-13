import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
const inviteParamsSchema = z.object({ id: objectId });
const inviteBodySchema = z.object({
  targetSalonSlug: z.string().trim().min(2).max(120),
  label: z.string().trim().max(120).optional(),
  expiresInHours: z.coerce.number().int().min(1).max(72).default(24)
});
const joinBodySchema = z.object({
  token: z.string().min(40).max(4000),
  label: z.string().trim().max(120).optional()
});
const invitePayloadSchema = z.object({
  version: z.literal(1),
  organizationId: objectId,
  ownerSalonId: objectId,
  targetSalonId: objectId,
  targetSalonSlug: z.string().min(2).max(120),
  label: z.string().max(120).default(''),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(16).max(80)
});

type InvitePayload = z.infer<typeof invitePayloadSchema>;

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function requireAdmin(request: FastifyRequest) {
  const tenant = getTenant(request);
  if (tenant.role !== 'ADMIN') throw httpError(403, 'Esta operação exige o papel ADMIN.');
  return tenant;
}

function inviteSecret() {
  const secret = String(process.env.MULTIUNIT_INVITE_SECRET || process.env.JWT_SECRET || '').trim();
  if (secret.length < 32) {
    throw httpError(503, 'Segredo seguro para convites multiunidade não está configurado.');
  }
  return secret;
}

function signPart(payloadPart: string) {
  return createHmac('sha256', inviteSecret()).update(payloadPart).digest('base64url');
}

export function createOrganizationInviteToken(payload: InvitePayload) {
  const validated = invitePayloadSchema.parse(payload);
  const payloadPart = Buffer.from(JSON.stringify(validated), 'utf8').toString('base64url');
  return `${payloadPart}.${signPart(payloadPart)}`;
}

export function verifyOrganizationInviteToken(token: string) {
  const [payloadPart, signature, extra] = token.split('.');
  if (!payloadPart || !signature || extra) throw httpError(400, 'Convite multiunidade inválido.');

  const expected = signPart(payloadPart);
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw httpError(400, 'Assinatura do convite multiunidade inválida.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw httpError(400, 'Conteúdo do convite multiunidade inválido.');
  }

  const payload = invitePayloadSchema.parse(raw);
  if (payload.expiresAt <= Date.now()) throw httpError(410, 'Convite multiunidade expirado.');
  return payload;
}

/**
 * Vínculo multiunidade baseado em consentimento: o tenant dono gera um convite
 * assinado para um slug específico e somente o ADMIN desse tenant pode aceitá-lo.
 * O convite não concede acesso aos dados operacionais da outra unidade.
 */
export async function organizationNetworkRoutes(app: FastifyInstance) {
  app.post('/admin/organizations/:id/invite', async (request, reply) => {
    const owner = requireAdmin(request);
    const params = inviteParamsSchema.parse(request.params);
    const data = inviteBodySchema.parse(request.body);

    const organization = await prisma.organization.findFirst({
      where: { id: params.id, salonId: owner.salonId, status: 'ACTIVE' }
    });
    if (!organization) throw httpError(404, 'Organização não encontrada neste tenant.');

    const targetSalon = await prisma.salon.findUnique({
      where: { slug: data.targetSalonSlug },
      select: { id: true, slug: true, name: true }
    });
    if (!targetSalon) throw httpError(404, 'Unidade de destino não encontrada.');
    if (targetSalon.id === owner.salonId) throw httpError(400, 'Use uma unidade diferente do tenant administrador.');

    const existing = await prisma.organizationLocation.findFirst({
      where: { organizationId: organization.id, locationSalonId: targetSalon.id, salonId: owner.salonId, status: 'ACTIVE' }
    });
    if (existing) throw httpError(409, 'Esta unidade já pertence à organização.');

    const expiresAt = Date.now() + data.expiresInHours * 60 * 60 * 1000;
    const token = createOrganizationInviteToken({
      version: 1,
      organizationId: organization.id,
      ownerSalonId: owner.salonId,
      targetSalonId: targetSalon.id,
      targetSalonSlug: targetSalon.slug,
      label: data.label || targetSalon.name,
      expiresAt,
      nonce: randomBytes(18).toString('base64url')
    });

    return reply.status(201).send({
      token,
      organizationId: organization.id,
      targetSalonSlug: targetSalon.slug,
      expiresAt: new Date(expiresAt).toISOString(),
      message: 'Convite gerado. A unidade de destino precisa aceitar com um usuário ADMIN.'
    });
  });

  app.post('/admin/organizations/join', async (request, reply) => {
    const target = requireAdmin(request);
    const data = joinBodySchema.parse(request.body);
    const invite = verifyOrganizationInviteToken(data.token);

    if (invite.targetSalonId !== target.salonId) {
      throw httpError(403, 'Este convite foi emitido para outra unidade.');
    }
    if (invite.ownerSalonId === target.salonId) {
      throw httpError(400, 'O tenant administrador não pode aceitar o próprio convite.');
    }

    const [organization, currentSalon] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: invite.organizationId, salonId: invite.ownerSalonId, status: 'ACTIVE' }
      }),
      prisma.salon.findUnique({ where: { id: target.salonId }, select: { id: true, slug: true, name: true } })
    ]);
    if (!organization || !currentSalon) throw httpError(404, 'Organização ou unidade não está mais disponível.');
    if (currentSalon.slug !== invite.targetSalonSlug) throw httpError(409, 'Identidade da unidade não corresponde ao convite.');

    const existing = await prisma.organizationLocation.findFirst({
      where: {
        organizationId: organization.id,
        locationSalonId: target.salonId,
        salonId: invite.ownerSalonId,
        status: 'ACTIVE'
      }
    });
    if (existing) {
      return reply.status(200).send({
        location: existing,
        message: 'Unidade já vinculada; nenhum vínculo duplicado foi criado.'
      });
    }

    const location = await prisma.organizationLocation.create({
      data: {
        organizationId: organization.id,
        locationSalonId: target.salonId,
        label: data.label || invite.label || currentSalon.name,
        status: 'ACTIVE',
        salonId: invite.ownerSalonId
      }
    });

    return reply.status(201).send({
      location,
      organization: { id: organization.id, name: organization.name },
      message: 'Unidade vinculada por consentimento. O vínculo não compartilha dados operacionais entre tenants.'
    });
  });

  app.get('/admin/organizations/memberships', async (request) => {
    const target = requireAdmin(request);
    const memberships = await prisma.organizationLocation.findMany({
      where: { locationSalonId: target.salonId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
    const organizationIds = [...new Set(memberships.map((item) => item.organizationId))];
    const organizations = organizationIds.length
      ? await prisma.organization.findMany({
          where: { id: { in: organizationIds }, status: 'ACTIVE' },
          select: { id: true, name: true, document: true, status: true }
        })
      : [];
    return { memberships, organizations };
  });
}
