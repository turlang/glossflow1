import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

type ProbeResult = {
  endpoint: string;
  statusCode: number;
  ok: boolean;
  summary?: unknown;
};

const EXPECTED_MODULES = [
  'WHATSAPP',
  'POS',
  'PACOTES',
  'COMPRAS',
  'EQUIPE',
  'CLINICO',
  'PORTAL_CLIENTE',
  'RECURSOS'
] as const;

const PROBE_ENDPOINTS = [
  '/admin/homologation/commercial',
  '/admin/homologation/transactional',
  '/admin/homologation/operations',
  '/admin/homologation/checkout-flow',
  '/admin/homologation/validation-suite'
] as const;

function requireEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} obrigatório para a homologação QA.`);
  return value;
}

function assertQaDatabase(databaseUrl: string, expectedDatabase: string) {
  if (process.env.QA_COMMERCIAL_PROBES_ENABLED !== 'true') {
    throw new Error('QA_COMMERCIAL_PROBES_ENABLED precisa ser true.');
  }
  if (process.env.QA_ENVIRONMENT !== 'qa') {
    throw new Error('QA_ENVIRONMENT precisa ser qa.');
  }
  if (process.env.QA_CONFIRMATION !== 'RUN_COMMERCIAL_QA_PROBES') {
    throw new Error('Confirmação inválida para probes comerciais QA.');
  }

  const parsed = new URL(databaseUrl);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL QA precisa usar mongodb:// ou mongodb+srv://.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!databaseName || databaseName !== expectedDatabase || !databaseName.toLowerCase().includes('qa')) {
    throw new Error('DATABASE_URL não aponta para o banco QA declarado.');
  }
}

function safeJson(responseBody: string) {
  try {
    return JSON.parse(responseBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function summarizePayload(endpoint: string, payload: Record<string, unknown>) {
  if (endpoint === '/admin/homologation/commercial') {
    const modules = Array.isArray(payload.modules) ? payload.modules : [];
    return {
      ok: payload.ok === true,
      summary: payload.summary || null,
      modules: modules.map((item) => {
        const module = item as Record<string, unknown>;
        const readiness = (module.readiness || null) as Record<string, unknown> | null;
        const providerEvidence = (module.providerEvidence || null) as Record<string, unknown> | null;
        return {
          module: module.module,
          readiness: readiness
            ? { status: readiness.status, maturity: readiness.maturity, nextAction: readiness.nextAction }
            : null,
          providerEvidence: providerEvidence
            ? {
                status: providerEvidence.status,
                trialMode: providerEvidence.trialMode,
                definitiveSenderValidated: providerEvidence.definitiveSenderValidated
              }
            : null,
          manualEvidenceCount: Array.isArray(module.manualEvidence) ? module.manualEvidence.length : 0,
          blockerCount: Array.isArray(module.promotionBlockers) ? module.promotionBlockers.length : 0
        };
      })
    };
  }

  return {
    ok: payload.ok !== false,
    checkedAt: payload.checkedAt || null,
    summary: payload.summary || null,
    diagnostics: payload.diagnostics || payload.checks || payload.domains || null
  };
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const expectedDatabase = String(process.env.QA_DATABASE_NAME || 'glossflow-qa').trim();
  const adminEmail = requireEnv('QA_ADMIN_EMAIL');
  const adminPassword = requireEnv('QA_ADMIN_PASSWORD');
  assertQaDatabase(databaseUrl, expectedDatabase);

  const app = buildApp();
  await app.ready();

  let refreshToken = '';
  let accessToken = '';

  try {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminEmail, password: adminPassword }
    });

    if (login.statusCode !== 200) {
      throw new Error(`Login QA falhou com HTTP ${login.statusCode}.`);
    }

    const loginPayload = safeJson(login.body);
    accessToken = String(loginPayload.token || '');
    refreshToken = String(loginPayload.refreshToken || '');
    if (!accessToken) throw new Error('Login QA não retornou access token.');

    const user = (loginPayload.user || {}) as Record<string, unknown>;
    if (user.role !== 'ADMIN') throw new Error('Usuário QA precisa ter papel ADMIN.');

    const results: ProbeResult[] = [];
    let commercialPayload: Record<string, unknown> | null = null;

    for (const endpoint of PROBE_ENDPOINTS) {
      const response = await app.inject({
        method: 'GET',
        url: endpoint,
        headers: { authorization: `Bearer ${accessToken}` }
      });
      const payload = safeJson(response.body);
      if (endpoint === '/admin/homologation/commercial') commercialPayload = payload;

      results.push({
        endpoint,
        statusCode: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 300,
        summary: summarizePayload(endpoint, payload)
      });
    }

    const failedEndpoints = results.filter((item) => !item.ok);
    if (failedEndpoints.length) {
      throw new Error(`Probes QA falharam em ${failedEndpoints.map((item) => item.endpoint).join(', ')}.`);
    }

    const commercialModules = Array.isArray(commercialPayload?.modules)
      ? commercialPayload.modules.map((item) => String((item as Record<string, unknown>).module || ''))
      : [];
    const missingModules = EXPECTED_MODULES.filter((module) => !commercialModules.includes(module));
    if (commercialModules.length !== EXPECTED_MODULES.length || missingModules.length) {
      throw new Error(`Contrato comercial QA incompleto. Módulos ausentes: ${missingModules.join(', ') || 'contagem divergente'}.`);
    }

    const report = {
      ok: true,
      checkedAt: new Date().toISOString(),
      database: expectedDatabase,
      tenant: {
        role: user.role,
        salonId: user.salonId || null
      },
      policy: {
        productionMutation: false,
        automaticPromotion: false,
        manualEvidenceStillRequired: true
      },
      probes: results
    };

    const outputJson = path.resolve(process.cwd(), 'qa-commercial-probe-report.json');
    const outputMd = path.resolve(process.cwd(), 'qa-commercial-probe-summary.md');
    fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const commercialSummary = summarizePayload('/admin/homologation/commercial', commercialPayload || {}) as {
      modules?: Array<{ module?: unknown; readiness?: { status?: unknown; maturity?: unknown } | null }>;
    };
    const moduleLines = (commercialSummary.modules || []).map(
      (item) => `- ${String(item.module)}: ${String(item.readiness?.status || 'UNKNOWN')} (${String(item.readiness?.maturity ?? 'n/a')}%)`
    );
    const markdown = [
      '# Marco 36 — Probes comerciais QA',
      '',
      `- Banco: \`${expectedDatabase}\``,
      `- Endpoints executados: ${results.length}/${PROBE_ENDPOINTS.length}`,
      '- Autenticação ADMIN QA: OK',
      '- Mutação de produção: não executada',
      '- Promoção automática de maturidade: desabilitada',
      '- Evidência manual/comercial continua obrigatória para promoção.',
      '',
      '## Módulos',
      ...moduleLines,
      '',
      '## Probes',
      ...results.map((item) => `- ${item.ok ? '✅' : '❌'} ${item.endpoint} — HTTP ${item.statusCode}`),
      ''
    ].join('\n');
    fs.writeFileSync(outputMd, markdown, 'utf8');

    process.stdout.write(`[qa-commercial-probes] OK: ${results.length} endpoints e ${commercialModules.length} módulos validados no contrato QA.\n`);
  } finally {
    if (accessToken) {
      await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: refreshToken ? { refreshToken } : {}
      }).catch(() => undefined);
    }
    await app.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const normalized = error instanceof Error ? error : new Error(String(error));
  process.stderr.write(`[qa-commercial-probes] falhou: ${normalized.message}\n`);
  process.exit(1);
});
