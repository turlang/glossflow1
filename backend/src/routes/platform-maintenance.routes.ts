import { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthContext } from './helpers';

const resetTools = require('../../scripts/reset-test-data.js') as {
  resolveProtectedPlatformState: (client: typeof prisma) => Promise<ProtectedState>;
  preview: (client: typeof prisma, state: ProtectedState) => Promise<Array<{ label: string; count: number }>>;
  executeReset: (client: typeof prisma, state: ProtectedState) => Promise<void>;
  verifyCleanState: (client: typeof prisma, state: ProtectedState) => Promise<{ superAdminEmail: string; platformSlug: string }>;
};

type ProtectedState = {
  superAdmin: {
    id: string;
    email: string;
    password: string;
    role: string;
    active: boolean;
  };
  platformSalon: {
    id: string;
    slug: string;
  };
};

const confirmationPhrase = 'ZERAR GLOSSFLOW';
const executeSchema = z.object({
  password: z.string().min(1, 'Informe a senha atual do Super Admin.'),
  confirmation: z.literal(confirmationPhrase)
});

function authContext(request: FastifyRequest) {
  return (request as FastifyRequest & { user?: AuthContext }).user;
}

async function protectedStateForRequest(request: FastifyRequest) {
  const state = await resetTools.resolveProtectedPlatformState(prisma);
  const user = authContext(request);
  if (!user || user.id !== state.superAdmin.id) {
    const error = new Error('Somente o Super Admin principal configurado pode executar esta manutenção.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  return state;
}

/**
 * Manutenção destrutiva da plataforma, exclusiva do SUPER_ADMIN principal.
 * Estas rotas ficam fora do hook de auditoria porque o estado final precisa
 * permanecer realmente limpo, sem recriar um AuditLog após o reset.
 */
export async function platformMaintenanceRoutes(app: FastifyInstance) {
  app.get('/platform-admin/maintenance/clean-reset/preview', async (request) => {
    const state = await protectedStateForRequest(request);
    const rows = await resetTools.preview(prisma, state);
    return {
      confirmationPhrase,
      preserved: {
        superAdminEmail: state.superAdmin.email,
        platformSlug: state.platformSalon.slug
      },
      remove: rows,
      totalRecords: rows.reduce((sum, row) => sum + row.count, 0)
    };
  });

  app.post('/platform-admin/maintenance/clean-reset', async (request, reply) => {
    const data = executeSchema.parse(request.body);
    const state = await protectedStateForRequest(request);

    const passwordMatches = await bcrypt.compare(data.password, state.superAdmin.password);
    if (!passwordMatches) {
      return reply.status(403).send({ message: 'Senha atual do Super Admin inválida.' });
    }

    const before = await resetTools.preview(prisma, state);
    await resetTools.executeReset(prisma, state);
    const verified = await resetTools.verifyCleanState(prisma, state);

    return {
      ok: true,
      message: 'GlossFlow zerado com sucesso. Faça login novamente.',
      removed: before,
      preserved: verified
    };
  });
}
