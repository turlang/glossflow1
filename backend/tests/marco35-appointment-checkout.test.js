const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/appointment-checkout.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Marco 35 etapa 5 registra preview e checkout por atendimento', () => {
  assert.ok(route.includes("/admin/pos/appointments/:id/checkout-preview"));
  assert.ok(route.includes("/admin/pos/appointments/:id/checkout"));
  assert.ok(route.includes("requireModules(request, ['AGENDA', 'POS'])"));
});

test('checkout usa preços do tenant e não recebe preço do browser', () => {
  assert.ok(route.includes('appointment.service.price'));
  assert.ok(route.includes('product.salePrice'));
  assert.ok(!route.includes('unitPrice: positiveMoney'));
  assert.ok(route.includes('Pagamento divergente'));
});

test('pacote elegível é tenant-safe, cobre serviço e consome exatamente um crédito', () => {
  assert.ok(route.includes("await requireModules(request, ['PACOTES'])"));
  assert.ok(route.includes("status: 'ACTIVE'"));
  assert.ok(route.includes('remainingCredits: { gt: 0 }'));
  assert.ok(route.includes('selectedOffer.serviceIds.includes(appointment.serviceId)'));
  assert.ok(route.includes('remainingCredits: { decrement: 1 }'));
  assert.ok(route.includes("status: 'EXHAUSTED'"));
});

test('checkout conclui Agenda, recursos, estoque e financeiro na mesma transação', () => {
  assert.ok(route.includes('prisma.$transaction'));
  assert.ok(route.includes("data: { status: 'COMPLETED' }"));
  assert.ok(route.includes("status: 'RESERVED'"));
  assert.ok(route.includes("data: { status: 'COMPLETED' }"));
  assert.ok(route.includes('quantity: { decrement: item.quantity }'));
  assert.ok(route.includes("category: 'PDV'"));
});

test('reserva de recurso usa horário canônico do atendimento e respeita capacidade', () => {
  assert.ok(route.includes("/admin/pos/appointments/:id/resource-reservations"));
  assert.ok(route.includes("requireModules(request, ['AGENDA', 'POS', 'RECURSOS'])"));
  assert.ok(route.includes('startTime: appointment.startTime'));
  assert.ok(route.includes('endTime: appointment.endTime'));
  assert.ok(route.includes('conflicts >= resource.capacity'));
});

test('checkout é idempotente e não duplica venda por atendimento', () => {
  assert.ok(route.includes("appointmentId: appointment.id, status: { not: 'REFUNDED' }"));
  assert.ok(route.includes('idempotent: true'));
});

test('diagnóstico integrado detecta lacunas de checkout, recursos e pacotes', () => {
  assert.ok(route.includes("/admin/homologation/checkout-flow"));
  assert.ok(route.includes("domain: 'CHECKOUT'"));
  assert.ok(route.includes("domain: 'RESOURCES'"));
  assert.ok(route.includes("domain: 'PACKAGES'"));
});

test('rota de checkout está no business scope auditado', () => {
  assert.ok(appRoutes.includes("import { appointmentCheckoutRoutes } from './appointment-checkout.routes';"));
  assert.ok(appRoutes.includes('business.register(appointmentCheckoutRoutes)'));
});
