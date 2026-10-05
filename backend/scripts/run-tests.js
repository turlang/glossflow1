const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const files = readdirSync('tests')
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => `tests/${file}`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env, TZ: 'UTC' }
});
process.exit(result.status ?? 1);
