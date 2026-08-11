import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { isProduction } from './environment';

/** Origens administrativas/demonstração configuradas explicitamente. */
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const rootDomain = (process.env.PUBLIC_ROOT_DOMAIN || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

/**
 * Política CORS multi-tenant.
 *
 * Além das origens estáticas, aceita subdomínios white-label e domínios
 * próprios já cadastrados em `Salon.customDomain`.
 */
async function isAllowedOrigin(origin: string) {
  if (allowedOrigins.includes(origin)) return true;
  if (!isProduction && developmentOrigins.includes(origin)) return true;

  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }

  if (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))) {
    return true;
  }

  if (isProduction && hostname) {
    const salon = await prisma.salon.findFirst({
      where: { customDomain: hostname },
      select: { id: true }
    });
    if (salon) return true;
  }

  return false;
}

/** Registra CORS sem espalhar detalhes de white-label pelo bootstrap da API. */
export function registerCorsPolicy(app: FastifyInstance) {
  app.register(cors, {
    origin: (origin, callback) => {
      // Chamadas server-side, Postman e healthchecks podem não enviar Origin.
      if (!origin) return callback(null, true);

      isAllowedOrigin(origin)
        .then((allowed) => {
          if (allowed) return callback(null, true);
          return callback(new Error(`Origem não permitida pelo CORS: ${origin}`), false);
        })
        .catch((error) => callback(error, false));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Salon-Slug', 'X-Salon-Host'],
    exposedHeaders: ['X-GlossFlow-Build'],
    credentials: true
  });
}
