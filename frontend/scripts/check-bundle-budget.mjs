import console from 'node:console';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const maxJsKb = Number(process.env.BUNDLE_MAX_JS_KB || 320);
const maxCssKb = Number(process.env.BUNDLE_MAX_CSS_KB || 180);

const files = await readdir(assetsDir);
const measured = [];

for (const file of files) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
  const info = await stat(join(assetsDir, file));
  measured.push({ file, bytes: info.size, kb: Number((info.size / 1024).toFixed(2)) });
}

const violations = measured.filter((item) => {
  if (item.file.endsWith('.js')) return item.kb > maxJsKb;
  if (item.file.endsWith('.css')) return item.kb > maxCssKb;
  return false;
});

const largestJs = measured.filter((item) => item.file.endsWith('.js')).sort((a, b) => b.bytes - a.bytes)[0];
const largestCss = measured.filter((item) => item.file.endsWith('.css')).sort((a, b) => b.bytes - a.bytes)[0];

console.log(`Bundle budget: JS <= ${maxJsKb}KB por chunk; CSS <= ${maxCssKb}KB por arquivo.`);
if (largestJs) console.log(`Maior chunk JS: ${largestJs.file} (${largestJs.kb}KB).`);
if (largestCss) console.log(`Maior CSS: ${largestCss.file} (${largestCss.kb}KB).`);

if (violations.length) {
  for (const violation of violations) {
    console.error(`BUNDLE_BUDGET_EXCEEDED ${violation.file}: ${violation.kb}KB`);
  }
  process.exit(1);
}
