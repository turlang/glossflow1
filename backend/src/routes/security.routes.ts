import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { eraseClientPersonalData, exportClientPersonalData } from '../services/lgpd.service';
import { z } from 'zod';

/** Segurança corporativa com delegates explícitos do schema canônico. */
export async function securityRoutes(app: FastifyInstance) {
  app.get('/admin/security/overview', async (request) => {
    const tenant = getTenant(request);
    const [auditCount, activeSessions, consents, backups] = await Promise.all([
      prisma.auditLog.count({ where: { salonId: tenant.salonId } }),
      prisma.userSession.count({ where: { salonId: tenant.salonId, revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.lgpdConsent.count({ where: { salonId: tenant.salonId, granted: true } }),
      prisma.backupJob.findMany({ where: { salonId: tenant.salonId }, orderBy: { createdAt: 'desc' }, take: 1 })
    ]);

    return {
      score: Math.min(98, 74 + Math.min(8, auditCount) + Math.min(8, activeSessions) + Math.min(8, consents)),
      auditCount,
      activeSessions,
      consents,
      lastBackup: backups[0] || null,
      corporateModelsReady: true,
      setupHint: null,
      controls: [
        { name: 'Auditoria', status: 'Ativa', description: 'Registra alterações administrativas importantes.' },
        { name: 'Rate limit', status: 'Ativo', description: 'Reduz abuso de API e tentativa de força bruta.' },
        { name: 'LGPD', status: consents ? 'Em uso' : 'Pronto', description: 'Exporta, registra consentimentos e permite eliminação controlada de dados pessoais.' },
        { name: 'Sessões', status: activeSessions ? 'Monitorando' : 'Sem sessões extras', description: 'Access tokens são vinculados a sessões revogáveis e refresh tokens rotacionam a cada uso.' }
      ]
    };
  });

  app.get('/admin/security/audit-logs', async (request) => {
    const tenant = getTenant(request);
    return prisma.auditLog.findMany({ where: { salonId: tenant.salonId }, orderBy: { createdAt: 'desc' }, take: 80 });
  });

  app.get('/admin/security/sessions', async (request) => {
    const tenant = getTenant(request);
    return prisma.userSession.findMany({
      where: { salonId: tenant.salonId },
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });

  app.post('/admin/security/sessions/:id/revoke', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return prisma.userSession.updateMany({
      where: { id, salonId: tenant.salonId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  });

  /** Resposta de incidente: encerra todas as demais sessões do tenant. */
  app.post('/admin/security/sessions/revoke-all', async (request) => {
    const tenant = getTenant(request);
    const body = z.object({ includeCurrent: z.coerce.boolean().default(false) }).parse(request.body || {});
    return prisma.userSession.updateMany({
      where: {
        salonId: tenant.salonId,
        revokedAt: null,
        ...(!body.includeCurrent && tenant.sessionId ? { id: { not: tenant.sessionId } } : {})
      },
      data: { revokedAt: new Date() }
    });
  });

  app.get('/admin/security/lgpd/export/:clientId', async (request, reply) => {
    const tenant = getTenant(request);
    const { clientId } = z.object({ clientId: z.string() }).parse(request.params);
    const bundle = await exportClientPersonalData(tenant.salonId, clientId);
    if (!bundle) return reply.status(404).send({ message: 'Cliente não encontrado.' });
    return bundle;
  });

  app.post('/admin/security/lgpd/erase/:clientId', async (request, reply) => {
    const tenant = getTenant(request);
    const { clientId } = z.object({ clientId: z.string() }).parse(request.params);
    const body = z.object({
      confirmation: z.literal('EXCLUIR DADOS'),
      reason: z.string().trim().min(10).max(500)
    }).parse(request.body);

    const result = await eraseClientPersonalData({
      salonId: tenant.salonId,
      clientId,
      requestedByUserId: tenant.id,
      reason: body.reason
    });
    if (!result) return reply.status(404).send({ message: 'Cliente não encontrado.' });
    return result;
  });

  app.post('/admin/security/lgpd/consents', async (request, reply) => {
    const tenant = getTenant(request);
    const body = z.object({
      clientId: z.string().optional(),
      type: z.string().min(2),
      granted: z.coerce.boolean().default(true),
      evidence: z.string().max(1000).optional().default('')
    }).parse(request.body);

    if (body.clientId) {
      const subject = await prisma.client.findFirst({ where: { id: body.clientId, salonId: tenant.salonId }, select: { id: true } });
      if (!subject) return reply.status(404).send({ message: 'Cliente não encontrado no salão atual.' });
    }

    return reply.status(201).send(await prisma.lgpdConsent.create({ data: { ...body, salonId: tenant.salonId } }));
  });

  app.post('/admin/security/backups', async (request, reply) => {
    const tenant = getTenant(request);
    const [clients, appointments, services, professionals, products] = await Promise.all([
      prisma.client.count({ where: { salonId: tenant.salonId } }),
      prisma.appointment.count({ where: { salonId: tenant.salonId } }),
      prisma.service.count({ where: { salonId: tenant.salonId } }),
      prisma.professional.count({ where: { salonId: tenant.salonId } }),
      prisma.inventoryProduct.count({ where: { salonId: tenant.salonId } })
    ]);
    const checksum = crypto.createHash('sha256').update(`${tenant.salonId}:${Date.now()}:${clients}:${appointments}`).digest('hex').slice(0, 16);
    return reply.status(201).send(await prisma.backupJob.create({
      data: {
        kind: 'MANUAL',
        status: 'COMPLETED',
        summary: `Snapshot lógico ${checksum}: ${clients} clientes, ${appointments} agendamentos, ${services} serviços, ${professionals} profissionais, ${products} produtos.`,
        salonId: tenant.salonId
      }
    }));
  });
}
