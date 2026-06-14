import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { loginSchema } from './schemas';

const ACCESS_TOKEN_MINUTES = Number(process.env.ACCESS_TOKEN_MINUTES || 30);
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: { id: string; email: string; role: string; salonId: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, salonId: user.salonId },
    process.env.JWT_SECRET || 'glossflow-dev-secret',
    { expiresIn: `${ACCESS_TOKEN_MINUTES}m` }
  );
}

function getSessionModel() {
  return (prisma as any).userSession;
}

/**
 * Rotas de autenticação corporativa.
 * -----------------------------------------------------------------------------
 * Esta versão mantém refresh token revogável quando o Prisma Client já foi
 * gerado com os modelos corporativos. Caso o ambiente local ainda esteja com um
 * Prisma Client antigo, o login não quebra: o usuário recebe access token e o
 * backend registra um aviso para o desenvolvedor rodar `npx prisma generate`.
 */
export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active) {
      return reply.status(401).send({ message: 'Usuário ou senha inválidos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return reply.status(401).send({ message: 'Usuário ou senha inválidos.' });

    const token = signAccessToken(user);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    const sessionModel = getSessionModel();

    if (sessionModel?.create) {
      await sessionModel.create({
        data: {
          userId: user.id,
          salonId: user.salonId,
          refreshTokenHash: hashToken(refreshToken),
          userAgent: String(request.headers['user-agent'] || ''),
          ip: request.ip || '',
          expiresAt
        }
      });
    } else {
      request.log.warn('Modelo UserSession não encontrado no Prisma Client. Rode: npx prisma generate && npx prisma db push. Login seguirá sem sessão revogável nesta execução.');
    }

    return reply.send({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, salonId: user.salonId } });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    if (!refreshToken) return reply.status(401).send({ message: 'Refresh token não informado.' });

    const sessionModel = getSessionModel();
    if (!sessionModel?.findFirst) return reply.status(501).send({ message: 'Sessões corporativas ainda não foram geradas no Prisma Client. Rode npx prisma generate.' });

    const session = await sessionModel.findFirst({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true }
    });

    if (!session || !session.user.active) return reply.status(401).send({ message: 'Sessão expirada ou revogada.' });

    await sessionModel.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return reply.send({ token: signAccessToken(session.user), user: { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role, salonId: session.user.salonId } });
  });

  app.post('/auth/logout', async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    const sessionModel = getSessionModel();
    if (refreshToken && sessionModel?.updateMany) {
      await sessionModel.updateMany({ where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return reply.status(204).send();
  });
}
