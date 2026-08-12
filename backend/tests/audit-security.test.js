require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/lib/prisma.ts');
const { writeAuditLog } = require('../src/routes/audit.ts');

test('auditoria correlaciona request/sessão/status sem registrar chaves sensíveis', async () => {
  const original = prisma.auditLog.create;
  let captured = null;
  prisma.auditLog.create = async ({ data }) => {
    captured = data;
    return data;
  };

  try {
    await writeAuditLog({
      method: 'POST',
      url: '/admin/security/backups/restore?dry=false',
      ip: '127.0.0.1',
      id: 'req-123',
      headers: { 'user-agent': 'test-agent' },
      body: {
        confirmation: 'RESTAURAR BACKUP',
        snapshot: { sensitive: true },
        password: 'never-log-this',
        reason: 'teste'
      },
      user: {
        id: '507f191e810c19729de860ea',
        email: 'admin@example.test',
        role: 'ADMIN',
        salonId: '507f1f77bcf86cd799439011',
        sessionId: '507f191e810c19729de860eb'
      }
    }, { statusCode: 403 });

    assert.equal(captured.path, '/admin/security/backups/restore');
    assert.equal(captured.metadata.requestId, 'req-123');
    assert.equal(captured.metadata.sessionId, '507f191e810c19729de860eb');
    assert.equal(captured.metadata.statusCode, 403);
    assert.equal(captured.metadata.outcome, 'DENIED_OR_FAILED');
    assert.deepEqual(captured.metadata.bodyKeys, ['confirmation', 'reason']);
    assert.equal(JSON.stringify(captured).includes('never-log-this'), false);
    assert.equal(JSON.stringify(captured).includes('sensitive'), false);
  } finally {
    prisma.auditLog.create = original;
  }
});
