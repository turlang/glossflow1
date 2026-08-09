import { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';

export type AuthContext = { id: string; role: string; salonId: string; email: string };

function cleanSlug(value?: string) {
  const normalized = (value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized) ? normalized : '';
}

function cleanHost(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
}

function notFound(message = 'Salão não encontrado.') {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 404;
  return error;
}

/**
 * Resolve a vitrine pública sem fixar um único salão no código.
 *
 * Prioridade:
 * 1. X-Salon-Slug ou ?salon=slug (homologação/preview);
 * 2. domínio próprio cadastrado no salão;
 * 3. subdomínio de PUBLIC_ROOT_DOMAIN, ex. ana.glossflow.com.br;
 * 4. DEFAULT_PUBLIC_SALON_SLUG para a demonstração principal.
 */
export async function getPublicSalon(request: FastifyRequest) {
  const query = (request.query || {}) as { salon?: string };
  const headerSlug = Array.isArray(request.headers['x-salon-slug'])
    ? request.headers['x-salon-slug'][0]
    : request.headers['x-salon-slug'];
  const requestedSlug = cleanSlug(String(headerSlug || query.salon || ''));

  if (requestedSlug) {
    const salon = await prisma.salon.findUnique({ where: { slug: requestedSlug } });
    if (!salon) throw notFound(`Salão '${requestedSlug}' não encontrado.`);
    return salon;
  }

  const headerHost = Array.isArray(request.headers['x-salon-host'])
    ? request.headers['x-salon-host'][0]
    : request.headers['x-salon-host'];
  const host = cleanHost(String(headerHost || ''));

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    const byCustomDomain = await prisma.salon.findFirst({ where: { customDomain: host } });
    if (byCustomDomain) return byCustomDomain;

    const rootDomain = cleanHost(process.env.PUBLIC_ROOT_DOMAIN || '');
    if (rootDomain && host.endsWith(`.${rootDomain}`)) {
      const subdomain = host.slice(0, -(rootDomain.length + 1)).split('.').pop() || '';
      const subdomainSlug = cleanSlug(subdomain);
      if (subdomainSlug && !['www', 'app', 'api'].includes(subdomainSlug)) {
        const bySubdomain = await prisma.salon.findUnique({ where: { slug: subdomainSlug } });
        if (bySubdomain) return bySubdomain;
      }
    }
  }

  const fallbackSlug = cleanSlug(process.env.DEFAULT_PUBLIC_SALON_SLUG || 'glossflow') || 'glossflow';
  const fallback = await prisma.salon.findUnique({ where: { slug: fallbackSlug } });
  if (!fallback) throw notFound('Salão público padrão não encontrado. Configure DEFAULT_PUBLIC_SALON_SLUG ou execute o seed.');
  return fallback;
}

/** Compatibilidade interna durante a migração da antiga vitrine única. */
export async function getMainSalon(request: FastifyRequest) {
  return getPublicSalon(request);
}

/** Garante isolamento multi-tenant usando salonId do token JWT. */
export function getTenant(request: FastifyRequest) {
  const user = (request as FastifyRequest & { user?: AuthContext }).user;
  if (!user?.salonId) throw new Error('Sessão administrativa sem contexto de salão. Faça login novamente.');
  return user;
}
