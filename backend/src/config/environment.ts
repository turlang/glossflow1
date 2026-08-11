/**
 * Contrato de ambiente do backend.
 *
 * Centralizar essas decisões evita que cada módulo interprete produção/build de
 * uma forma diferente e faz a API falhar cedo quando faltam segredos críticos.
 */

export const isProduction = process.env.NODE_ENV === 'production';

export const buildId = (
  process.env.RENDER_GIT_COMMIT
  || process.env.GIT_COMMIT
  || process.env.COMMIT_SHA
  || 'local'
).slice(0, 12);

/**
 * Em produção, configuração insegura deve impedir o processo de subir.
 * Integrações opcionais não entram aqui; apenas dependências essenciais da API.
 */
export function assertRequiredProductionEnv() {
  if (!isProduction) return;

  const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`);
  }

  if ((process.env.JWT_SECRET || '').length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção.');
  }
}
