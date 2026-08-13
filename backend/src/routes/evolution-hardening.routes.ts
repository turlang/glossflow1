import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');

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

function latestMarketingConsent(consents: Array<{ clientId: string | null; granted: boolean }>) {
  const result = new Map<string, boolean>();
  for (const consent of consents) {
    if (consent.clientId && !result.has(consent.clientId)) result.set(consent.clientId, consent.granted);
  }
  return result;
}

/** Marco 35 — Etapa 4: fechamento seguro de lacunas de Marketing, Multiunidade e Financeiro Avançado. */
export async function evolutionHardeningRoutes(app: FastifyInstance) {
  app.get('/admin/marketing/campaigns/:id/preview', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ id: objectId }).parse(request.params);
    const campaign = await prisma.marketingCampaign.findFirst({ where: { id: params.id, salonId: current.salonId } });
    if (!campaign) throw httpError(404, 'Campanha não encontrada.');
    if (campaign.segment !== 'ALL') throw httpError(409, 'Este estágio de homologação aceita somente o segmento ALL; outros segmentos exigem regra server-side explícita.');

    const [clients, consents] = await Promise.all([
      prisma.client.findMany({ where: { salonId: current.salonId }, select: { id: true, phone: true, email: true } }),
      prisma.lgpdConsent.findMany({ where: { salonId: current.salonId, type: 'MARKETING' }, orderBy: { createdAt: 'desc' }, select: { clientId: true, granted: true } })
    ]);
    const consentByClient = latestMarketingConsent(consents);
    const eligible = clients.filter((client) => consentByClient.get(client.id) === true);
    const contactable = eligible.filter((client) => campaign.channel === 'EMAIL' ? Boolean(client.email) : client.phone.replace(/\D/g, '').length >= 10);

    return {
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status, channel: campaign.channel, scheduledAt: campaign.scheduledAt },
      audience: {
        totalClients: clients.length,
        consented: eligible.length,
        contactable: contactable.length,
        excluded: clients.length - contactable.length
      },
      policy: 'Somente clientes cujo consentimento MARKETING mais recente está concedido entram no público elegível.'
    };
  });

  app.post('/admin/marketing/campaigns/:id/prepare', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ id: objectId }).parse(request.params);
    const body = z.object({ confirm: z.literal('PREPARAR CAMPANHA') }).parse(request.body);
    void body;
    const campaign = await prisma.marketingCampaign.findFirst({ where: { id: params.id, salonId: current.salonId } });
    if (!campaign) throw httpError(404, 'Campanha não encontrada.');
    if (campaign.status === 'SENT') throw httpError(409, 'Campanha já enviada.');
    if (campaign.status === 'SCHEDULED' && !campaign.scheduledAt) throw httpError(409, 'Campanha SCHEDULED precisa de scheduledAt.');

    const [clients, consents] = await Promise.all([
      prisma.client.findMany({ where: { salonId: current.salonId }, select: { id: true, phone: true, email: true } }),
      prisma.lgpdConsent.findMany({ where: { salonId: current.salonId, type: 'MARKETING' }, orderBy: { createdAt: 'desc' }, select: { clientId: true, granted: true } })
    ]);
    const consentByClient = latestMarketingConsent(consents);
    const eligible = clients.filter((client) => consentByClient.get(client.id) === true);
    const contactable = eligible.filter((client) => campaign.channel === 'EMAIL' ? Boolean(client.email) : client.phone.replace(/\D/g, '').length >= 10);
    const metrics = {
      audienceCount: clients.length,
      consentedCount: eligible.length,
      contactableCount: contactable.length,
      excludedCount: clients.length - contactable.length,
      preparedAt: new Date().toISOString(),
      deliveryState: 'READY_FOR_PROVIDER'
    };
    await prisma.marketingCampaign.update({ where: { id: campaign.id }, data: { metrics } });
    return { ok: true, campaignId: campaign.id, metrics };
  });

  app.post('/admin/organizations/memberships/:id/leave', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ id: objectId }).parse(request.params);
    const membership = await prisma.organizationLocation.findFirst({ where: { id: params.id, locationSalonId: current.salonId, status: 'ACTIVE' } });
    if (!membership) throw httpError(404, 'Vínculo ativo de multiunidade não encontrado para este tenant.');
    return prisma.organizationLocation.update({ where: { id: membership.id }, data: { status: 'LEFT' } });
  });

  app.post('/admin/organizations/:organizationId/locations/:locationId/revoke', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ organizationId: objectId, locationId: objectId }).parse(request.params);
    const organization = await prisma.organization.findFirst({ where: { id: params.organizationId, salonId: current.salonId, status: 'ACTIVE' } });
    if (!organization) throw httpError(404, 'Organização não encontrada neste tenant.');
    const membership = await prisma.organizationLocation.findFirst({ where: { id: params.locationId, organizationId: organization.id, salonId: current.salonId, status: 'ACTIVE' } });
    if (!membership) throw httpError(404, 'Unidade ativa não encontrada nesta organização.');
    return prisma.organizationLocation.update({ where: { id: membership.id }, data: { status: 'REVOKED' } });
  });

  app.get('/admin/organizations/:id/network', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ id: objectId }).parse(request.params);
    const organization = await prisma.organization.findFirst({ where: { id: params.id, salonId: current.salonId, status: 'ACTIVE' } });
    if (!organization) throw httpError(404, 'Organização não encontrada neste tenant.');
    const locations = await prisma.organizationLocation.findMany({ where: { organizationId: organization.id, salonId: current.salonId }, orderBy: { createdAt: 'desc' } });
    const salonIds = [...new Set(locations.map((item) => item.locationSalonId))];
    const salons = salonIds.length ? await prisma.salon.findMany({ where: { id: { in: salonIds } }, select: { id: true, slug: true, name: true } }) : [];
    return { organization, locations, salons };
  });

  app.post('/admin/finance-advanced/sync-purchase-payables', async (request) => {
    const current = requireAdmin(request);
    const orders = await prisma.purchaseOrder.findMany({ where: { salonId: current.salonId, status: 'RECEIVED' }, orderBy: { receivedAt: 'desc' }, take: 300 });
    let created = 0;
    let skipped = 0;
    for (const order of orders) {
      const existing = await prisma.receivablePayable.findFirst({ where: { salonId: current.salonId, type: 'PAYABLE', description: { contains: order.number } } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.receivablePayable.create({
        data: {
          type: 'PAYABLE',
          description: `Compra ${order.number}`,
          category: 'COMPRAS',
          amount: order.total,
          dueDate: order.expectedAt || order.receivedAt || new Date(),
          status: 'OPEN',
          salonId: current.salonId
        }
      });
      created += 1;
    }
    return { ok: true, scanned: orders.length, created, skipped };
  });

  app.post('/admin/finance-advanced/fiscal-documents/:id/issue', async (request) => {
    const current = requireAdmin(request);
    const params = z.object({ id: objectId }).parse(request.params);
    const body = z.object({ provider: z.string().trim().min(2).max(80), externalId: z.string().trim().min(2).max(120), number: z.string().trim().min(1).max(80) }).parse(request.body);
    const fiscal = await prisma.fiscalDocument.findFirst({ where: { id: params.id, salonId: current.salonId } });
    if (!fiscal) throw httpError(404, 'Documento fiscal não encontrado.');
    if (fiscal.status === 'ISSUED') throw httpError(409, 'Documento fiscal já emitido.');
    return prisma.fiscalDocument.update({ where: { id: fiscal.id }, data: { provider: body.provider, externalId: body.externalId, number: body.number, status: 'ISSUED', issuedAt: new Date() } });
  });

  app.get('/admin/homologation/evolution', async (request) => {
    const current = requireAdmin(request);
    const [campaigns, locations, organizations, orders, fiscalDocuments] = await Promise.all([
      prisma.marketingCampaign.findMany({ where: { salonId: current.salonId }, take: 300 }),
      prisma.organizationLocation.findMany({ where: { salonId: current.salonId }, take: 300 }),
      prisma.organization.findMany({ where: { salonId: current.salonId }, take: 100 }),
      prisma.purchaseOrder.findMany({ where: { salonId: current.salonId, status: 'RECEIVED' }, take: 300 }),
      prisma.fiscalDocument.findMany({ where: { salonId: current.salonId }, take: 300 })
    ]);
    const findings: Array<{ severity: 'ERROR' | 'WARN'; domain: string; reference: string; message: string }> = [];
    const now = new Date();

    for (const campaign of campaigns) {
      if (campaign.status === 'SCHEDULED' && !campaign.scheduledAt) findings.push({ severity: 'ERROR', domain: 'MARKETING', reference: campaign.id, message: 'Campanha SCHEDULED sem data de agendamento.' });
      if (campaign.status === 'SCHEDULED' && campaign.scheduledAt && campaign.scheduledAt < now && !campaign.sentAt) findings.push({ severity: 'WARN', domain: 'MARKETING', reference: campaign.id, message: 'Campanha venceu o horário de disparo e ainda não foi enviada.' });
      if (campaign.status === 'SENT' && !campaign.sentAt) findings.push({ severity: 'ERROR', domain: 'MARKETING', reference: campaign.id, message: 'Campanha SENT sem sentAt.' });
    }

    const organizationIds = new Set(organizations.map((item) => item.id));
    for (const location of locations) {
      if (!organizationIds.has(location.organizationId)) findings.push({ severity: 'ERROR', domain: 'MULTIUNIT', reference: location.id, message: 'Vínculo referencia organização inexistente no tenant proprietário.' });
    }

    for (const order of orders) {
      const payable = await prisma.receivablePayable.findFirst({ where: { salonId: current.salonId, type: 'PAYABLE', description: { contains: order.number } } });
      if (!payable) findings.push({ severity: 'WARN', domain: 'FINANCE_PURCHASE', reference: order.number, message: 'Compra recebida ainda não sincronizada com contas a pagar.' });
    }

    for (const fiscal of fiscalDocuments.filter((item) => item.status === 'ISSUED')) {
      if (!fiscal.provider || !fiscal.externalId || !fiscal.number || !fiscal.issuedAt) findings.push({ severity: 'ERROR', domain: 'FISCAL', reference: fiscal.id, message: 'Documento ISSUED não possui evidência completa do provider.' });
    }

    const errors = findings.filter((item) => item.severity === 'ERROR').length;
    const warnings = findings.filter((item) => item.severity === 'WARN').length;
    return { ok: errors === 0, checkedAt: new Date().toISOString(), summary: { errors, warnings, findings: findings.length }, findings };
  });
}
