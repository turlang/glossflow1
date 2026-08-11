import fs from 'node:fs';

const source = 'frontend/src/styles.css';
const css = fs.readFileSync(source, 'utf8');

function mustIndex(marker, from = 0) {
  const index = css.indexOf(marker, from);
  if (index < 0) throw new Error(`CSS marker not found: ${marker}`);
  return index;
}

const section3 = mustIndex('/* 3. Header e vitrine pública');
const section4 = mustIndex('/* 4. Componentes reutilizáveis', section3);
const section5 = mustIndex('/* 5. Admin Enterprise', section4);
const section6 = mustIndex('/* 6. Onboarding e listas', section5);
const section8 = mustIndex('/* 8. Skeleton e responsividade', section6);
const fase1Text = 'Fase 1 — Agenda Enterprise';
const fase2Text = 'Fase 2 — Central de Automações Visual';
const fase3Text = 'Fase 3 — Assistente IA Operacional';
const fase4Text = 'Fase 4 — Dashboard Executivo';
const platformText = 'v9.4 — Segurança, UX Premium e PWA';
const fase1Label = mustIndex(fase1Text, section8);
const fase2Label = mustIndex(fase2Text, fase1Label);
const fase3Label = mustIndex(fase3Text, fase2Label);
const fase4Label = mustIndex(fase4Text, fase3Label);
const platformLabel = mustIndex(platformText, fase4Label);
const divider = '/* =========================================================';
const fase1 = css.lastIndexOf(divider, fase1Label);
const fase2 = css.lastIndexOf(divider, fase2Label);
const fase3 = css.lastIndexOf(divider, fase3Label);
const fase4 = css.lastIndexOf(divider, fase4Label);
const platform = css.lastIndexOf(divider, platformLabel);
if ([fase1, fase2, fase3, fase4, platform].some((value) => value < 0)) throw new Error('A phase divider could not be resolved.');

const layers = [
  ['frontend/src/styles.css', css.slice(0, section3).trimEnd() + '\n'],
  ['frontend/src/public-showcase.css', css.slice(section3, section4).trim() + '\n'],
  ['frontend/src/ui-primitives.css', css.slice(section4, section5).trim() + '\n'],
  ['frontend/src/admin-shell.css', css.slice(section5, section6).trim() + '\n'],
  ['frontend/src/admin-operations.css', css.slice(section6, section8).trim() + '\n'],
  ['frontend/src/responsive.css', css.slice(section8, fase1).trim() + '\n'],
  ['frontend/src/agenda-enterprise.css', css.slice(fase1, fase2).trim() + '\n'],
  ['frontend/src/admin-business.css', [css.slice(fase2, fase3), css.slice(fase3, fase4), css.slice(fase4, platform)].map((part) => part.trim()).join('\n\n') + '\n'],
  ['frontend/src/admin-platform.css', css.slice(platform).trim() + '\n']
];

const rebuilt = layers.map(([, content]) => content.trim()).join('\n');
const original = css.trim();
if (rebuilt !== original) {
  throw new Error('Layer split would change CSS source text or order.');
}

for (const [file, content] of layers) fs.writeFileSync(file, content, 'utf8');

const mainFile = 'frontend/src/main.jsx';
let main = fs.readFileSync(mainFile, 'utf8');
const oldImport = "import './styles.css';";
const imports = [
  "import './styles.css';",
  "import './public-showcase.css';",
  "import './ui-primitives.css';",
  "import './admin-shell.css';",
  "import './admin-operations.css';",
  "import './responsive.css';",
  "import './agenda-enterprise.css';",
  "import './admin-business.css';",
  "import './admin-platform.css';"
].join('\n');
if (!main.includes(oldImport)) throw new Error('Main stylesheet import not found.');
main = main.replace(oldImport, imports);
fs.writeFileSync(mainFile, main, 'utf8');

console.log('CSS split completed with byte-order equivalence across layers.');
