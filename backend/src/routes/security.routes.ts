import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { eraseClientPersonalData, exportClientPersonalData } from '../services/lgpd.service';
import { previewTenantRetention, runTenantRetention } from '../services/data-retention.service';
import { createTenantBackup, restoreTenantBackup, verifyTenantBackup } from '../services/tenant-backup.service';
import { activeUserSessionWhere, notRevokedUserSessionWhere } from '../services/user-session.service';
import { z } from 'zod';

/** Segurança corporativa com delegates explícitos do schema canônico. */
export async function securityRoutes(app: FastifyInstance) {
  app.get('/admin/security/overview', async (request) => {
    const tenant = getTenant(request);
    const [auditCount, activeSessions, consents, backups] = await Promise.all([
      prisma.auditLog.count({ where: { salonId: tenant.salonId } }),
      prisma.userSession.count({ where: { salonId: tenant.salonId, ...activeUserSessionWhere() } }),
      prisma.lgpdConsent.count({ where: { salonId: tenant.salonId, granted: true } }),
      prisma.backupJob.findMany({ where: { salonId: tenant.salonId }, orderBy: { createdAt: 'desc' }, take: 1 })
    ]);

    return {
      score: Math.min(98, 74 + Math.min(8, auditCount) + Math.min(8, activeSessions) + Math.min(8, consents)),
      auditCount,
      activeSessions,
      consents,
      lastBackup: backups[0] || null,
      restoreEnabled: String(process.env.BACKUP_RESTORE_ENABLED || 'false').toLowerCase() === 'true',
      corporateModelsReady: true,
      setupHint: null,
      controls: [
        { name: 'Auditoria', status: 'Ativa', description: 'Registra alterações administrativas importantes.' },
        { name: 'Rate limit', status: 'Ativo', description: 'Reduz abuso por IP, superfície e tenant autenticado.' },
        { name: 'LGPD', status: consents ? 'Em uso' : 'Pronto', description: 'Exporta, registra consentimentos e permite eliminação controlada de dados pessoais.' },
        { name: 'Sessões', status: activeSessions ? 'Monitorando' : 'Sem sessões extras', description: 'Access tokens são vinculados a sessões revogáveis e refresh tokens rotacionam a cada uso.' },
        { name: 'Retenção', status: 'Controlada', description: 'Políticas explícitas permitem prévia antes de redigir ou eliminar registros antigos.' },
        { name: 'Backup', status: 'Assinado', description: 'Snapshot operacional possui assinatura HMAC; restore exige modo de recuperação explicitamente habilitado.' }
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
      where: { id, salonId: tenant.salonId, ...notRevokedUserSessionWhere() },
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
        ...notRevokedUserSessionWhere(),
        ...(!body.includeCurrent && tenant.sessionId ? { id: { not: tenant.sessionId } } : {})
      },
      data: { revokedAt: new Date() }
    });
  });

  app.get('/admin/security/lgpd/export/:clientId', async (request, reply) => {
    const tenant = getTenant(request);
    const { clientId } = z.object({ id: z.string() }).parse({ id: (request.params as { clientId?: string }).clientId });
    const bundle = await exportClientPersonalData(tenant.salonId, clientId);
    if (!bundle) return reply.status(404).send({ message: 'Cliente não encontrado.' });
    reply.header('Cache-Control', 'no-store');
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

  app.get('/admin/security/retention/preview', async (request) => {
    const tenant = getTenant(request);
    return previewTenantRetention(tenant.salonId);
  });

  app.post('/admin/security/retention/run', async (request) => {
    const tenant = getTenant(request);
    z.object({ confirmation: z.literal('APLICAR RETENCAO') }).parse(request.body);
    return runTenantRetention({ salonId: tenant.salonId, userId: tenant.id });
  });

  /** Cria um snapshot assinado e registra somente metadados do backup no banco. */
  app.post('/admin/security/backups', async (request, reply) => {
    const tenant = getTenant(request);
    const { envelope, counts } = await createTenantBackup(tenant.salonId);
    const summary = `Snapshot assinado ${envelope.signature.slice(0, 12)}: ${counts.clients} clientes, ${counts.appointments} agendamentos, ${counts.services} serviços, ${counts.professionals} profissionais e ${counts.inventoryProducts} produtos.`;
    const job = await prisma.backupJob.create({
      data: { kind: 'MANUAL_SIGNED', status: 'COMPLETED', summary, salonId: tenant.salonId }
    });
    reply.header('Cache-Control', 'no-store');
    return reply.status(201).send({ ...job, counts, snapshot: envelope });
  });

  app.post('/admin/security/backups/validate', async (request, reply) => {
    const tenant = getTenant(request);
    const body = z.object({ snapshot: z.unknown() }).parse(request.body);
    try {
      const snapshot = verifyTenantBackup(body.snapshot, tenant.salonId);
      return { ok: true, schema: snapshot.schema, createdAt: snapshot.createdAt };
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : 'Backup inválido.' });
    }
  });

  app.post('/admin/security/backups/restore', async (request, reply) => {
    const tenant = getTenant(request);
    const body = z.object({
      confirmation: z.literal('RESTAURAR BACKUP'),
      snapshot: z.unknown()
    }).parse(request.body);
    try {
      return await restoreTenantBackup({ salonId: tenant.salonId, requestedByUserId: tenant.id, snapshot: body.snapshot });
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : 'Restore não pôde ser executado.' });
    }
  });
}
