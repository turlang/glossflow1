import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { getTenantSubscriptionAccess } from '../services/saas-lifecycle.service';
import { loginSchema } from './schemas';

const ACCESS_TOKEN_MINUTES = Number(process.env.ACCESS_TOKEN_MINUTES || 30);
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET obrigatório em produção.');
    }
    return 'glossflow-local-development-secret';
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção.');
  }
  return secret;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: { id: string; email: string; role: string; salonId: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, salonId: user.salonId },
    getJwtSecret(),
    { expiresIn: `${ACCESS_TOKEN_MINUTES}m` }
  );
}

function accessMessage(code: string) {
  if (code === 'TRIAL_EXPIRED') return 'O período de avaliação deste salão terminou.';
  if (code === 'PAST_DUE_BLOCKED') return 'O acesso está temporariamente bloqueado por pendência da assinatura.';
  return 'A assinatura deste salão está cancelada.';
}

async function contractBlock(user: { role: string; salonId: string }) {
  if (user.role === 'SUPER_ADMIN') return null;
  const access = await getTenantSubscriptionAccess(user.salonId);
  if (access.allowed) return null;
  return {
    message: accessMessage(access.code),
    code: access.code,
    subscriptionStatus: access.status,
    endsAt: access.endsAt
  };
}

/** Sessões revogáveis são contrato obrigatório do schema corporativo. */
export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active) {
      return reply.status(401).send({ message: 'Usuário ou senha inválidos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return reply.status(401).send({ message: 'Usuário ou senha inválidos.' });

    const blocked = await contractBlock(user);
    if (blocked) return reply.status(403).send(blocked);

    const token = signAccessToken(user);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        salonId: user.salonId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: String(request.headers['user-agent'] || ''),
        ip: request.ip || '',
        expiresAt
      }
    });

    return reply.send({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, salonId: user.salonId } });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    if (!refreshToken) return reply.status(401).send({ message: 'Refresh token não informado.' });

    const session = await prisma.userSession.findFirst({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true }
    });

    if (!session || !session.user.active) return reply.status(401).send({ message: 'Sessão expirada ou revogada.' });

    const blocked = await contractBlock(session.user);
    if (blocked) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return reply.status(403).send(blocked);
    }

    await prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return reply.send({ token: signAccessToken(session.user), user: { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role, salonId: session.user.salonId } });
  });

  app.post('/auth/logout', async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string };
    if (refreshToken) {
      await prisma.userSession.updateMany({
        where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    return reply.status(204).send();
  });
}
