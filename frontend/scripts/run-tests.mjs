import { spawnSync } from 'node:child_process';
import process from 'node:process';
const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } }
);
process.exit(result.status ?? 1);
