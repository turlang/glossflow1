/**
 * Validador simples de variáveis obrigatórias para deploy.
 * Mantém falhas claras antes do build/start em Render ou qualquer CI.
 */
const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

if ((process.env.JWT_SECRET || '').length < 32) {
  console.error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  process.exit(1);
}

console.log('Ambiente validado com sucesso.');
