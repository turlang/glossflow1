/**
 * Ponto único de captura de erros operacionais.
 *
 * Hoje ele funciona como stub seguro: não exige instalar o SDK oficial do
 * Sentry para o projeto compilar. Quando uma conta Sentry real for criada,
 * instale @sentry/node e substitua este ponto por Sentry.captureException.
 */
export function captureOperationalError(error: unknown, context: Record<string, unknown> = {}) {
  const dsn = process.env.SENTRY_DSN;
  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    capturedAt: new Date().toISOString()
  };

  if (!dsn) {
    return { ok: false, mode: 'local-log', payload };
  }

  // O SDK oficial do Sentry pode ser instalado depois. Este stub mantém o projeto
  // pronto para receber a DSN sem quebrar o build nem exigir conta externa no ZIP.
  return { ok: true, mode: 'ready', dsnConfigured: true, payload };
}
