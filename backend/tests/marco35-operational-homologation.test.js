const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/operational-homologation.routes.ts'), 'utf8');
const appRoutes = fs.readFileSync(path.join(root, 'src/routes/appRoutes.ts'), 'utf8');

test('Marco 35 etapa 3 possui diagnóstico operacional ADMIN-only', () => {
  assert.ok(route.includes("app.get('/admin/homologation/operations'"));
  assert.ok(route.includes("tenant.role !== 'ADMIN'"));
});

test('diagnóstico valida equipe, metas e folha', () => {
  assert.ok(route.includes('prisma.timeClockEntry.findMany'));
  assert.ok(route.includes('prisma.staffGoal.findMany'));
  assert.ok(route.includes('prisma.payrollRun.findMany'));
  assert.ok(route.includes('goal.periodEnd <= goal.periodStart'));
  assert.ok(route.includes('payrollEntriesSchema.safeParse'));
  assert.ok(route.includes('payroll.grossTotal'));
});

test('diagnóstico clínico preserva consistência cliente-atendimento e consentimento', () => {
  assert.ok(route.includes('prisma.clinicalRecord.findMany'));
  assert.ok(route.includes('appointment.clientId !== record.clientId'));
  assert.ok(route.includes("record.recordType === 'CONSENT'"));
  assert.ok(route.includes('record.consentText.trim()'));
  assert.ok(route.includes('record.signedAt'));
});

test('diagnóstico do portal valida vínculo, SHA-256, expiração e uso', () => {
  assert.ok(route.includes('prisma.clientPortalAccess.findMany'));
  assert.ok(route.includes('/^[a-f\\d]{64}$/i.test(access.tokenHash)'));
  assert.ok(route.includes('access.expiresAt <= now'));
  assert.ok(route.includes('access.lastUsedAt > access.expiresAt'));
});

test('diagnóstico de recursos detecta referências inválidas e overbooking', () => {
  assert.ok(route.includes('prisma.resourceReservation.findMany'));
  assert.ok(route.includes('reservation.endTime <= reservation.startTime'));
  assert.ok(route.includes('simultaneous > resource.capacity'));
  assert.ok(route.includes("candidate.status === 'RESERVED'"));
});

test('todas as consultas principais permanecem tenant-safe', () => {
  assert.ok(route.includes('const salonId = current.salonId'));
  const tenantScopedQueries = (route.match(/where: \{ salonId/g) || []).length;
  assert.ok(tenantScopedQueries >= 10, `esperadas consultas tenant-safe, encontradas ${tenantScopedQueries}`);
});

test('rota operacional está registrada no business scope auditado', () => {
  assert.ok(appRoutes.includes("import { operationalHomologationRoutes } from './operational-homologation.routes';"));
  assert.ok(appRoutes.includes('business.register(operationalHomologationRoutes);'));
});
