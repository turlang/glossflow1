import { prisma } from '../lib/prisma';

export type ExternalCostPolicy = {
  monthlyLimitBr: number;
  warningPercent: number;
  domainMonthlyBr: number;
};

const DEFAULT_POLICY: ExternalCostPolicy = {
  monthlyLimitBr: 100,
  warningPercent: 80,
  domainMonthlyBr: 0
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function currentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodBounds(periodKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) throw new Error('Período inválido. Use YYYY-MM.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Período inválido. Use YYYY-MM.');
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0))
  };
}

export async function getExternalCostPolicy(salonId: string): Promise<ExternalCostPolicy> {
  const last = await prisma.auditLog.findFirst({
    where: { salonId, resource: 'ExternalCostPolicy', action: 'EXTERNAL_COST_POLICY_UPDATED' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });

  const metadata = (last?.metadata || {}) as Record<string, unknown>;
  return {
    monthlyLimitBr: Math.max(0, asNumber(metadata.monthlyLimitBr, DEFAULT_POLICY.monthlyLimitBr)),
    warningPercent: Math.min(100, Math.max(1, asNumber(metadata.warningPercent, DEFAULT_POLICY.warningPercent))),
    domainMonthlyBr: Math.max(0, asNumber(metadata.domainMonthlyBr, DEFAULT_POLICY.domainMonthlyBr))
  };
}

export async function saveExternalCostPolicy(salonId: string, policy: ExternalCostPolicy) {
  const normalized: ExternalCostPolicy = {
    monthlyLimitBr: Math.max(0, Number(policy.monthlyLimitBr || 0)),
    warningPercent: Math.min(100, Math.max(1, Number(policy.warningPercent || 80))),
    domainMonthlyBr: Math.max(0, Number(policy.domainMonthlyBr || 0))
  };

  await prisma.auditLog.create({
    data: {
      action: 'EXTERNAL_COST_POLICY_UPDATED',
      resource: 'ExternalCostPolicy',
      resourceId: salonId,
      method: 'PUT',
      path: `/platform-admin/salons/${salonId}/external-cost-policy`,
      salonId,
      metadata: normalized
    }
  });

  return normalized;
}

export async function recordExternalCostEntry(input: {
  salonId: string;
  provider: 'META' | 'AI' | 'OTHER';
  amountBr: number;
  description: string;
  periodKey?: string;
}) {
  const periodKey = input.periodKey || currentPeriodKey();
  periodBounds(periodKey);
  const amountBr = Number(input.amountBr || 0);
  if (!Number.isFinite(amountBr) || amountBr < 0) throw new Error('Valor de custo inválido.');

  return prisma.auditLog.create({
    data: {
      action: 'EXTERNAL_COST_RECORDED',
      resource: 'ExternalCostEntry',
      resourceId: periodKey,
      method: 'POST',
      path: `/platform-admin/salons/${input.salonId}/external-costs`,
      salonId: input.salonId,
      metadata: {
        provider: input.provider,
        amountBr,
        description: String(input.description || '').slice(0, 300),
        periodKey
      }
    }
  });
}

export async function removeExternalCostEntry(salonId: string, entryId: string) {
  const existing = await prisma.auditLog.findFirst({
    where: { id: entryId, salonId, resource: 'ExternalCostEntry' },
    select: { id: true }
  });
  if (!existing) return false;
  await prisma.auditLog.delete({ where: { id: entryId } });
  return true;
}

export async function recordAiUsage(input: {
  salonId: string;
  responseId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}) {
  return prisma.auditLog.create({
    data: {
      action: 'AI_USAGE',
      resource: 'ExternalUsage',
      resourceId: input.responseId || undefined,
      method: 'OPENAI',
      path: '/v1/responses',
      salonId: input.salonId,
      metadata: {
        provider: 'AI',
        model: input.model || '',
        inputTokens: Math.max(0, Number(input.inputTokens || 0)),
        outputTokens: Math.max(0, Number(input.outputTokens || 0)),
        totalTokens: Math.max(0, Number(input.totalTokens || 0))
      }
    }
  }).catch(() => undefined);
}

export async function getExternalCostSnapshot(salonId: string, periodKey = currentPeriodKey()) {
  const { start, end } = periodBounds(periodKey);
  const policy = await getExternalCostPolicy(salonId);

  const [manualEntries, usageLogs, whatsappLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { salonId, resource: 'ExternalCostEntry', resourceId: periodKey },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, metadata: true }
    }),
    prisma.auditLog.findMany({
      where: { salonId, resource: 'ExternalUsage', action: 'AI_USAGE', createdAt: { gte: start, lt: end } },
      select: { metadata: true }
    }),
    prisma.auditLog.findMany({
      where: { salonId, resource: 'WhatsAppMessage', createdAt: { gte: start, lt: end } },
      select: { metadata: true }
    })
  ]);

  const providerTotals = { META: 0, AI: 0, OTHER: 0 };
  const entries = manualEntries.map((entry) => {
    const metadata = (entry.metadata || {}) as Record<string, unknown>;
    const provider = ['META', 'AI', 'OTHER'].includes(String(metadata.provider))
      ? String(metadata.provider) as keyof typeof providerTotals
      : 'OTHER';
    const amountBr = Math.max(0, asNumber(metadata.amountBr, 0));
    providerTotals[provider] += amountBr;
    return {
      id: entry.id,
      provider,
      amountBr,
      description: String(metadata.description || ''),
      createdAt: entry.createdAt
    };
  });

  let aiInputTokens = 0;
  let aiOutputTokens = 0;
  let aiTotalTokens = 0;
  let aiRequests = 0;
  for (const log of usageLogs) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    aiRequests += 1;
    aiInputTokens += Math.max(0, asNumber(metadata.inputTokens, 0));
    aiOutputTokens += Math.max(0, asNumber(metadata.outputTokens, 0));
    aiTotalTokens += Math.max(0, asNumber(metadata.totalTokens, 0));
  }

  let whatsappOutboundMessages = 0;
  let whatsappInboundMessages = 0;
  for (const log of whatsappLogs) {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    if (metadata.direction === 'OUT') whatsappOutboundMessages += 1;
    if (metadata.direction === 'IN') whatsappInboundMessages += 1;
  }

  const manualVariableCost = providerTotals.META + providerTotals.AI + providerTotals.OTHER;
  const totalCostBr = manualVariableCost + policy.domainMonthlyBr;
  const usagePercent = policy.monthlyLimitBr > 0 ? (totalCostBr / policy.monthlyLimitBr) * 100 : 0;
  const status = usagePercent >= 100 ? 'REVIEW' : usagePercent >= policy.warningPercent ? 'WARNING' : 'OK';

  return {
    periodKey,
    policy,
    costs: {
      metaBr: providerTotals.META,
      aiBr: providerTotals.AI,
      otherBr: providerTotals.OTHER,
      domainBr: policy.domainMonthlyBr,
      totalBr: totalCostBr,
      remainingBr: Math.max(0, policy.monthlyLimitBr - totalCostBr),
      usagePercent: Number(usagePercent.toFixed(1)),
      status
    },
    usage: {
      whatsappInboundMessages,
      whatsappOutboundMessages,
      aiRequests,
      aiInputTokens,
      aiOutputTokens,
      aiTotalTokens
    },
    entries
  };
}
