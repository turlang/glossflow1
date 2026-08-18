import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

type JsonObject = Record<string, any>;
type ScenarioResult = {
  module: 'POS' | 'PACOTES' | 'COMPRAS' | 'EQUIPE' | 'CLINICO' | 'PORTAL_CLIENTE' | 'RECURSOS';
  ok: boolean;
  checks: string[];
};

function required(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} obrigatório para cenários funcionais QA.`);
  return value;
}

function assertQaDatabase(databaseUrl: string, expectedDatabase: string) {
  if (process.env.QA_FUNCTIONAL_SCENARIOS_ENABLED !== 'true') {
    throw new Error('QA_FUNCTIONAL_SCENARIOS_ENABLED precisa ser true.');
  }
  if (String(process.env.QA_ENVIRONMENT || '').toLowerCase() !== 'qa') {
    throw new Error('QA_ENVIRONMENT precisa ser qa.');
  }
  if (process.env.QA_CONFIRMATION !== 'RUN_QA_FUNCTIONAL_SCENARIOS') {
    throw new Error('Confirmação inválida para cenários funcionais QA.');
  }

  const parsed = new URL(databaseUrl);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL QA precisa usar mongodb:// ou mongodb+srv://.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!databaseName || databaseName !== expectedDatabase || !/(qa|test|staging)/i.test(databaseName)) {
    throw new Error('DATABASE_URL não aponta para o banco QA declarado.');
  }
}

function json(body: string): JsonObject {
  try {
    return JSON.parse(body) as JsonObject;
  } catch {
    return {};
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const expectedDatabase = String(process.env.QA_DATABASE_NAME || 'glossflow-qa').trim();
  const adminEmail = required('QA_ADMIN_EMAIL');
  const adminPassword = required('QA_ADMIN_PASSWORD');
  assertQaDatabase(databaseUrl, expectedDatabase);

  const app = buildApp();
  await app.ready();

  let accessToken = '';
  let refreshToken = '';
  const scenarios: ScenarioResult[] = [];
  const runKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const call = async (
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    payload: unknown = undefined,
    expected: number[] = [200]
  ) => {
    const response = await app.inject({
      method,
      url,
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
      ...(payload === undefined ? {} : { payload })
    });
    if (!expected.includes(response.statusCode)) {
      const body = response.body.slice(0, 500);
      throw new Error(`${method} ${url} retornou HTTP ${response.statusCode}; esperado ${expected.join('/')}. Resposta: ${body}`);
    }
    return { response, body: json(response.body) };
  };

  try {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminEmail, password: adminPassword }
    });
    assert(login.statusCode === 200, `Login QA falhou com HTTP ${login.statusCode}.`);
    const loginBody = json(login.body);
    accessToken = String(loginBody.token || '');
    refreshToken = String(loginBody.refreshToken || '');
    const user = (loginBody.user || {}) as JsonObject;
    assert(accessToken, 'Login QA não retornou access token.');
    assert(user.role === 'ADMIN', 'Cenários funcionais exigem ADMIN QA.');
    const salonId = String(user.salonId || '');
    assert(/^[a-f\d]{24}$/i.test(salonId), 'Login QA não retornou salonId válido.');

    const now = Date.now();
    const appointmentStart = new Date(now + 24 * 60 * 60 * 1000);
    const appointmentEnd = new Date(appointmentStart.getTime() + 60 * 60 * 1000);

    const client = await prisma.client.create({
      data: {
        name: `M36 QA Cliente ${runKey}`,
        phone: `55${String(now).slice(-11)}`,
        notes: `Fixture funcional ${runKey}`,
        salonId
      }
    });
    const alternateClient = await prisma.client.create({
      data: {
        name: `M36 QA Cliente Alternativo ${runKey}`,
        phone: `54${String(now + 1).slice(-11)}`,
        notes: `Fixture funcional alternativo ${runKey}`,
        salonId
      }
    });
    const service = await prisma.service.create({
      data: {
        name: `M36 QA Serviço ${runKey}`,
        description: 'Serviço exclusivo de homologação automatizada.',
        price: 100,
        durationMin: 60,
        active: true,
        salonId
      }
    });
    const professional = await prisma.professional.create({
      data: {
        name: `M36 QA Profissional ${runKey}`,
        specialty: 'Homologação QA',
        active: true,
        servicesConfigured: true,
        serviceIds: [service.id],
        salonId
      }
    });
    const checkoutProduct = await prisma.inventoryProduct.create({
      data: {
        name: `M36 QA Produto Checkout ${runKey}`,
        category: 'QA',
        quantity: 10,
        minimumQuantity: 0,
        costPrice: 10,
        salePrice: 25,
        active: true,
        salonId
      }
    });
    const refundProduct = await prisma.inventoryProduct.create({
      data: {
        name: `M36 QA Produto Estorno ${runKey}`,
        category: 'QA',
        quantity: 5,
        minimumQuantity: 0,
        costPrice: 5,
        salePrice: 15,
        active: true,
        salonId
      }
    });
    const purchaseProduct = await prisma.inventoryProduct.create({
      data: {
        name: `M36 QA Produto Compra ${runKey}`,
        category: 'QA',
        quantity: 0,
        minimumQuantity: 0,
        costPrice: 4,
        salePrice: 9,
        active: true,
        salonId
      }
    });
    const appointment = await prisma.appointment.create({
      data: {
        clientName: client.name,
        clientPhone: client.phone,
        clientId: client.id,
        startTime: appointmentStart,
        endTime: appointmentEnd,
        status: 'CONFIRMED',
        notes: `Fixture funcional ${runKey}`,
        salonId,
        serviceId: service.id,
        professionalId: professional.id
      }
    });
    const secondAppointment = await prisma.appointment.create({
      data: {
        clientName: alternateClient.name,
        clientPhone: alternateClient.phone,
        clientId: alternateClient.id,
        startTime: appointmentStart,
        endTime: appointmentEnd,
        status: 'CONFIRMED',
        notes: `Fixture recurso pós-checkout ${runKey}`,
        salonId,
        serviceId: service.id,
        professionalId: professional.id
      }
    });

    // PACOTES
    const packageOfferCall = await call('POST', '/admin/customer-plans/packages', {
      name: `M36 QA Pacote ${runKey}`,
      description: 'Pacote funcional automatizado',
      price: 180,
      totalCredits: 2,
      serviceIds: [service.id],
      validityDays: 90,
      active: true
    }, [201]);
    const packageOfferId = String(packageOfferCall.body.id || '');
    assert(packageOfferId, 'Criação do pacote não retornou id.');
    const assignmentCall = await call('POST', '/admin/customer-plans/packages/assign', {
      clientId: client.id,
      packageOfferId
    }, [201]);
    const clientPackageId = String(assignmentCall.body.id || '');
    assert(clientPackageId, 'Atribuição do pacote não retornou id.');

    // RECURSOS antes do checkout: reserva canônica, idempotência e conflito.
    const resourceCall = await call('POST', '/admin/resources', {
      name: `M36 QA Sala ${runKey}`,
      type: 'ROOM',
      capacity: 1,
      notes: 'Recurso de homologação',
      active: true
    }, [201]);
    const resourceId = String(resourceCall.body.id || '');
    assert(resourceId, 'Criação de recurso não retornou id.');
    const firstReservation = await call('POST', `/admin/pos/appointments/${appointment.id}/resource-reservations`, {
      resourceId,
      notes: `Reserva integrada ${runKey}`
    }, [201]);
    const reservationId = String(firstReservation.body.id || '');
    assert(reservationId, 'Reserva integrada não retornou id.');
    await call('POST', `/admin/pos/appointments/${appointment.id}/resource-reservations`, {
      resourceId,
      notes: `Reserva integrada repetida ${runKey}`
    }, [200]);
    await call('POST', '/admin/resources/reservations', {
      resourceId,
      appointmentId: secondAppointment.id,
      startTime: appointmentStart.toISOString(),
      endTime: appointmentEnd.toISOString(),
      notes: 'Conflito esperado antes do checkout'
    }, [400]);

    // Checkout integrado: Agenda → Recurso → Pacote → PDV → Estoque → Financeiro.
    const checkoutCall = await call('POST', `/admin/pos/appointments/${appointment.id}/checkout`, {
      packageId: clientPackageId,
      products: [{ inventoryProductId: checkoutProduct.id, quantity: 1 }],
      payments: [{ method: 'CASH', amount: 25 }],
      notes: `Checkout integrado ${runKey}`
    }, [201]);
    const integratedSale = (checkoutCall.body.sale || {}) as JsonObject;
    assert(integratedSale.id, 'Checkout integrado não retornou venda.');
    const idempotentCheckout = await call('POST', `/admin/pos/appointments/${appointment.id}/checkout`, {
      packageId: clientPackageId,
      products: [{ inventoryProductId: checkoutProduct.id, quantity: 1 }],
      payments: [{ method: 'CASH', amount: 25 }],
      notes: `Checkout repetido ${runKey}`
    }, [200]);
    assert(idempotentCheckout.body.idempotent === true, 'Segundo checkout não foi reconhecido como idempotente.');

    const [packageAfter, checkoutProductAfter, appointmentAfter, reservationAfter, integratedRevenue] = await Promise.all([
      prisma.clientPackage.findUnique({ where: { id: clientPackageId } }),
      prisma.inventoryProduct.findUnique({ where: { id: checkoutProduct.id } }),
      prisma.appointment.findUnique({ where: { id: appointment.id } }),
      prisma.resourceReservation.findUnique({ where: { id: reservationId } }),
      prisma.financialEntry.findFirst({ where: { salonId, category: 'PDV', description: `Venda ${String(integratedSale.number)}` } })
    ]);
    assert(packageAfter?.remainingCredits === 1, 'Pacote não consumiu exatamente 1 crédito.');
    assert(checkoutProductAfter?.quantity === 9, 'Checkout não baixou exatamente 1 unidade do produto.');
    assert(appointmentAfter?.status === 'COMPLETED', 'Checkout não concluiu o atendimento.');
    assert(reservationAfter?.status === 'COMPLETED', 'Checkout não liberou/concluiu a reserva vinculada.');
    assert(integratedRevenue?.amount === 25, 'Checkout não gerou lançamento financeiro PDV esperado.');

    const postCheckoutReservation = await call('POST', '/admin/resources/reservations', {
      resourceId,
      appointmentId: secondAppointment.id,
      startTime: appointmentStart.toISOString(),
      endTime: appointmentEnd.toISOString(),
      notes: 'Reserva deve ser aceita após liberação do primeiro atendimento'
    }, [201]);
    assert(postCheckoutReservation.body.id, 'Recurso não foi liberado para nova reserva após checkout.');

    scenarios.push({
      module: 'PACOTES',
      ok: true,
      checks: ['criação e atribuição', 'elegibilidade por serviço', 'consumo de 1 crédito', 'idempotência sem consumo duplicado']
    });
    scenarios.push({
      module: 'RECURSOS',
      ok: true,
      checks: ['reserva integrada', 'idempotência da reserva', 'bloqueio por capacidade', 'liberação após checkout']
    });

    // POS independente: venda, baixa, estorno, reposição e proteção contra estorno duplicado.
    const posSaleCall = await call('POST', '/admin/pos/sales', {
      clientId: client.id,
      items: [{
        kind: 'PRODUCT',
        description: refundProduct.name,
        quantity: 1,
        unitPrice: 15,
        inventoryProductId: refundProduct.id
      }],
      payments: [{ method: 'CASH', amount: 15 }],
      discount: 0,
      notes: `Venda para estorno ${runKey}`
    }, [201]);
    const posSaleId = String(posSaleCall.body.id || '');
    const posSaleNumber = String(posSaleCall.body.number || '');
    assert(posSaleId && posSaleNumber, 'Venda POS não retornou identificadores.');
    const stockAfterSale = await prisma.inventoryProduct.findUnique({ where: { id: refundProduct.id } });
    assert(stockAfterSale?.quantity === 4, 'Venda POS não baixou o estoque.');
    await call('POST', `/admin/pos/sales/${posSaleId}/refund`, {}, [200]);
    await call('POST', `/admin/pos/sales/${posSaleId}/refund`, {}, [400]);
    const [stockAfterRefund, refundedSale, refundMovement, refundExpense] = await Promise.all([
      prisma.inventoryProduct.findUnique({ where: { id: refundProduct.id } }),
      prisma.sale.findUnique({ where: { id: posSaleId } }),
      prisma.inventoryMovement.findFirst({ where: { salonId, productId: refundProduct.id, type: 'IN', reason: `Estorno ${posSaleNumber}` } }),
      prisma.financialEntry.findFirst({ where: { salonId, type: 'EXPENSE', category: 'REFUND', description: `Estorno ${posSaleNumber}` } })
    ]);
    assert(stockAfterRefund?.quantity === 5, 'Estorno POS não restaurou o estoque.');
    assert(refundedSale?.status === 'REFUNDED', 'Venda POS não ficou REFUNDED.');
    assert(refundMovement?.quantity === 1, 'Estorno POS não registrou movimento IN esperado.');
    assert(refundExpense?.amount === 15, 'Estorno POS não registrou despesa de refund esperada.');
    scenarios.push({
      module: 'POS',
      ok: true,
      checks: ['checkout integrado', 'venda avulsa', 'baixa de estoque', 'estorno', 'reposição de estoque', 'idempotência/proteção contra duplicidade']
    });

    // COMPRAS: pedido, recebimento seguro, estoque, custo, contas a pagar e duplicidade.
    const supplierCall = await call('POST', '/admin/procurement/suppliers', {
      name: `M36 QA Fornecedor ${runKey}`,
      document: '',
      phone: '',
      email: '',
      contact: '',
      notes: 'Fornecedor exclusivo de QA',
      active: true
    }, [201]);
    const supplierId = String(supplierCall.body.id || '');
    const orderCall = await call('POST', '/admin/procurement/orders', {
      supplierId,
      items: [{ productId: purchaseProduct.id, description: purchaseProduct.name, quantity: 3, unitCost: 4 }],
      expectedAt: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
      notes: `Pedido QA ${runKey}`
    }, [201]);
    const orderId = String(orderCall.body.id || '');
    const orderNumber = String(orderCall.body.number || '');
    assert(orderId && orderNumber, 'Pedido de compra não retornou identificadores.');
    await call('POST', `/admin/procurement/orders/${orderId}/receive`, {}, [200]);
    await call('POST', `/admin/procurement/orders/${orderId}/receive-safe`, {}, [409]);
    const [receivedOrder, purchaseProductAfter, purchaseMovement, payable] = await Promise.all([
      prisma.purchaseOrder.findUnique({ where: { id: orderId } }),
      prisma.inventoryProduct.findUnique({ where: { id: purchaseProduct.id } }),
      prisma.inventoryMovement.findFirst({ where: { salonId, productId: purchaseProduct.id, type: 'IN', reason: `Recebimento ${orderNumber}` } }),
      prisma.receivablePayable.findFirst({ where: { salonId, type: 'PAYABLE', description: { contains: orderNumber } } })
    ]);
    assert(receivedOrder?.status === 'RECEIVED', 'Pedido não ficou RECEIVED.');
    assert(purchaseProductAfter?.quantity === 3 && purchaseProductAfter.costPrice === 4, 'Recebimento não atualizou estoque/custo esperado.');
    assert(purchaseMovement?.quantity === 3, 'Recebimento não gerou movimento IN canônico.');
    assert(payable?.amount === 12, 'Recebimento não gerou conta a pagar esperada.');
    scenarios.push({
      module: 'COMPRAS',
      ok: true,
      checks: ['pedido completo', 'recebimento seguro', 'estoque e custo', 'conta a pagar', 'bloqueio de recebimento duplicado']
    });

    // EQUIPE: máquina de estados do ponto, meta e sobreposição de folha.
    const clockBase = new Date(now + 2 * 60 * 60 * 1000);
    const clockTypes = ['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT'] as const;
    for (let index = 0; index < clockTypes.length; index += 1) {
      await call('POST', '/admin/team-management/time-clock', {
        professionalId: professional.id,
        type: clockTypes[index],
        occurredAt: new Date(clockBase.getTime() + index * 60_000).toISOString(),
        notes: `Ponto QA ${runKey}`
      }, [201]);
    }
    await call('POST', '/admin/team-management/time-clock', {
      professionalId: professional.id,
      type: 'CLOCK_OUT',
      occurredAt: new Date(clockBase.getTime() + 5 * 60_000).toISOString(),
      notes: 'Transição inválida esperada'
    }, [409]);

    const teamPeriodStart = new Date(now + 10 * 365 * 24 * 60 * 60 * 1000);
    const teamPeriodEnd = new Date(teamPeriodStart.getTime() + 1);
    await call('POST', '/admin/team-management/goals', {
      professionalId: professional.id,
      metric: 'REVENUE',
      target: 1000,
      periodStart: teamPeriodStart.toISOString(),
      periodEnd: new Date(teamPeriodStart.getTime() + 86_400_000).toISOString()
    }, [201]);
    const payrollPayload = {
      periodStart: teamPeriodStart.toISOString(),
      periodEnd: teamPeriodEnd.toISOString(),
      entries: [{
        professionalId: professional.id,
        professionalName: professional.name,
        baseAmount: 100,
        commissionAmount: 20,
        bonusAmount: 10,
        deductions: 5
      }],
      notes: `Folha QA ${runKey}`
    };
    const payrollCall = await call('POST', '/admin/team-management/payroll', payrollPayload, [201]);
    assert(Number(payrollCall.body.grossTotal) === 125, 'Gross total da folha QA divergiu do esperado.');
    await call('POST', '/admin/team-management/payroll', payrollPayload, [409]);
    scenarios.push({
      module: 'EQUIPE',
      ok: true,
      checks: ['sequência válida do ponto', 'rejeição de transição inválida', 'meta válida', 'folha operacional', 'bloqueio de período sobreposto']
    });

    // CLÍNICO: consentimento completo, vínculo appointment/client e proteção de cache.
    const consentCall = await call('POST', '/admin/clinical-records', {
      clientId: client.id,
      appointmentId: appointment.id,
      recordType: 'CONSENT',
      answers: { source: 'marco36-qa' },
      allergies: '',
      notes: `Consentimento QA ${runKey}`,
      photoUrls: [],
      signedBy: 'QA Automated Validation',
      signedAt: new Date().toISOString(),
      consentText: 'Consentimento fictício para homologação automatizada em banco QA isolado.'
    }, [201]);
    assert(String(consentCall.response.headers['cache-control'] || '').includes('no-store'), 'Prontuário clínico não retornou Cache-Control no-store.');
    await call('POST', '/admin/clinical-records', {
      clientId: alternateClient.id,
      appointmentId: appointment.id,
      recordType: 'ANAMNESIS',
      answers: {},
      allergies: '',
      notes: 'Mismatch esperado',
      photoUrls: [],
      signedBy: '',
      signedAt: null,
      consentText: ''
    }, [409]);
    scenarios.push({
      module: 'CLINICO',
      ok: true,
      checks: ['consentimento completo', 'vínculo cliente-atendimento', 'rejeição de client mismatch', 'no-store para dados clínicos']
    });

    // PORTAL: rotação, self-service, revogação e bloqueio pós-revogação.
    const portal1 = await call('POST', '/admin/client-portal/access', { clientId: client.id, expiresInHours: 24 }, [201]);
    assert(portal1.body.token, 'Primeiro link do portal não retornou token.');
    const firstPortalAccess = await prisma.clientPortalAccess.findFirst({
      where: { salonId, clientId: client.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(firstPortalAccess, 'Primeiro acesso do portal não foi persistido.');

    const portal2 = await call('POST', '/admin/client-portal/access', { clientId: client.id, expiresInHours: 24 }, [201]);
    const secondToken = String(portal2.body.token || '');
    assert(secondToken, 'Segundo link do portal não retornou token.');
    const portalAccesses = await prisma.clientPortalAccess.findMany({
      where: { salonId, clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    assert(portalAccesses.length === 2, 'Rotação do portal não gerou dois registros auditáveis.');
    assert(Boolean(portalAccesses[1].revokedAt), 'Link anterior do portal não foi revogado na rotação.');
    assert(!portalAccesses[0].revokedAt, 'Novo link do portal nasceu revogado.');

    const portalOverview = await call('GET', `/client-portal/${encodeURIComponent(secondToken)}/overview`, undefined, [200]);
    assert(String((portalOverview.body.client || {}).id || '') === client.id, 'Portal self-service retornou cliente divergente.');
    await call('POST', `/admin/client-portal/access/${portalAccesses[0].id}/revoke`, {}, [200]);
    await call('GET', `/client-portal/${encodeURIComponent(secondToken)}/overview`, undefined, [403]);
    scenarios.push({
      module: 'PORTAL_CLIENTE',
      ok: true,
      checks: ['criação de link', 'rotação com revogação anterior', 'self-service autenticado por token', 'revogação', 'bloqueio pós-revogação']
    });

    // Diagnósticos finais: os 7 domínios testados devem ficar sem erro.
    const transactional = await call('GET', '/admin/homologation/transactional', undefined, [200]);
    const operations = await call('GET', '/admin/homologation/operations', undefined, [200]);
    const checkoutFlow = await call('GET', '/admin/homologation/checkout-flow', undefined, [200]);
    const validation = await call('GET', '/admin/homologation/validation-suite', undefined, [200]);

    const transactionalErrors = Number((transactional.body.summary || {}).errors || 0);
    const operationsErrors = Number((operations.body.summary || {}).errors || 0);
    const checkoutErrors = Number((checkoutFlow.body.summary || {}).errors || 0);
    const validationFindings = Array.isArray(validation.body.findings) ? validation.body.findings as JsonObject[] : [];
    const nonWhatsappValidation = validationFindings.filter((item) => String(item.domain || '') !== 'WHATSAPP');

    assert(transactionalErrors === 0, `Diagnóstico transacional terminou com ${transactionalErrors} erro(s).`);
    assert(operationsErrors === 0, `Diagnóstico operacional terminou com ${operationsErrors} erro(s).`);
    assert(checkoutErrors === 0, `Diagnóstico de checkout terminou com ${checkoutErrors} erro(s).`);
    assert(nonWhatsappValidation.length === 0, `Validation suite encontrou ${nonWhatsappValidation.length} achado(s) fora de WhatsApp.`);

    const report = {
      ok: true,
      checkedAt: new Date().toISOString(),
      database: expectedDatabase,
      runKey,
      policy: {
        qaOnly: true,
        productionMutation: false,
        realMessaging: false,
        realPayments: false,
        automaticPromotion: false
      },
      scenarios,
      diagnostics: {
        transactional: transactional.body.summary || null,
        operations: operations.body.summary || null,
        checkoutFlow: checkoutFlow.body.summary || null,
        validationSuite: {
          summary: validation.body.summary || null,
          whatsappFindings: validationFindings.filter((item) => String(item.domain || '') === 'WHATSAPP').map((item) => ({
            severity: item.severity,
            reference: item.reference,
            message: item.message
          })),
          nonWhatsappFindings: nonWhatsappValidation.length
        }
      },
      remainingHumanEvidence: {
        WHATSAPP: 'Provider/sender definitivo, inbound/outbound e template autorizado.',
        CLINICO: 'Revisão humana de UX, segurança, auditoria e LGPD.',
        PORTAL_CLIENTE: 'Polimento e validação humana mobile/self-service.',
        EQUIPE: 'Folha legal/fiscal brasileira continua fora do escopo operacional.',
        COMPRAS: 'Recebimento parcial continua fora do modelo atual.'
      }
    };

    const jsonPath = path.resolve(process.cwd(), 'qa-functional-scenarios-report.json');
    const mdPath = path.resolve(process.cwd(), 'qa-functional-scenarios-summary.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const markdown = [
      '# Marco 36 — Cenários funcionais QA',
      '',
      `- Banco: \`${expectedDatabase}\``,
      `- Cenários aprovados: ${scenarios.length}/7`,
      '- Produção: não alterada',
      '- Mensagens/pagamentos reais: não executados',
      '',
      '## Módulos',
      ...scenarios.map((scenario) => `- ✅ ${scenario.module}: ${scenario.checks.join('; ')}`),
      '',
      '## Diagnósticos finais',
      `- Transacional: ${transactionalErrors} erro(s)`,
      `- Operações: ${operationsErrors} erro(s)`,
      `- Checkout: ${checkoutErrors} erro(s)`,
      `- Validation suite fora de WhatsApp: ${nonWhatsappValidation.length} achado(s)`,
      `- WhatsApp: ${validationFindings.filter((item) => String(item.domain || '') === 'WHATSAPP').length} achado(s) mantidos como bloqueio externo/comercial`,
      '',
      'A promoção para READY continua dependente das evidências humanas/provedor explicitadas no contrato comercial.',
      ''
    ].join('\n');
    fs.writeFileSync(mdPath, markdown, 'utf8');

    process.stdout.write(`[qa-functional-scenarios] OK: ${scenarios.length}/7 módulos funcionais validados no banco ${expectedDatabase}.\n`);
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
  process.stderr.write(`[qa-functional-scenarios] falhou: ${normalized.message}\n`);
  process.exit(1);
});
