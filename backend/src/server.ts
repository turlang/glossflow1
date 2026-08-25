/**
 * Copyright © 2026 Evandro Ricardo. All Rights Reserved.
 * Proprietary software. Unauthorized copying, modification, distribution,
 * or commercial use is prohibited. See LICENSE.md for terms.
 */

import 'dotenv/config';
import { buildApp } from './app';
import { assertRequiredProductionEnv, buildId } from './config/environment';
import { syncCriticalMongoIndexes } from './services/database-indexes.service';
import { ensureSuperAdminFromEnv } from './services/super-admin-bootstrap.service';
import { startReminderScheduler } from './services/reminder-scheduler.service';

assertRequiredProductionEnv();

const app = buildApp();

/** Bootstrap com efeitos colaterais restritos a este entrypoint. */
async function start() {
  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || '0.0.0.0';

  await ensureSuperAdminFromEnv({
    info: (message) => app.log.info(message),
    warn: (message) => app.log.warn(message)
  });

  // createIndexes é idempotente e não destrutivo. Uma falha isolada de índice
  // é registrada, mas não derruba um deploy que ainda consegue servir tráfego.
  await syncCriticalMongoIndexes({
    info: (message) => app.log.info(message),
    warn: (message) => app.log.warn(message)
  });

  await app.listen({ port, host });
  startReminderScheduler(app.log);
  app.log.info(`GlossFlow API rodando em ${host}:${port} • build ${buildId}`);
}

start().catch((error: unknown) => {
  const normalized = error instanceof Error ? error : new Error(String(error));
  app.log.error(normalized);
  process.exit(1);
});