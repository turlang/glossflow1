import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

/**
 * Guardrail estrutural do GlossFlow.
 *
 * O objetivo não é substituir lint/testes. Este script impede que artefatos
 * removidos durante a higienização retornem silenciosamente ao repositório e
 * que arquivos de ambiente/backup sejam versionados por engano.
 */

const repositoryRoot = process.cwd();

const forbiddenPaths = [
  'setup.js',
  'prisma/schema.prisma',
  'prisma/seed.js',
  'prisma/prisma.config.ts',
  'infra/render.blueprint.yaml',
  'COMO_USAR_GLOSSFLOW.txt'
];

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.vercel',
  '.render'
]);

const forbiddenBackupSuffixes = ['.bak', '.old', '.orig', '.tmp', '.temp'];
const allowedEnvironmentFiles = new Set([
  '.env.example',
  'backend/.env.example',
  'frontend/.env.example'
]);

const violations = [];

for (const forbiddenPath of forbiddenPaths) {
  if (existsSync(join(repositoryRoot, forbiddenPath))) {
    violations.push(`Artefato legado/duplicado não permitido: ${forbiddenPath}`);
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = join(directory, entry.name);
    const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;

    const fileName = basename(repositoryPath);
    const isEnvironmentFile = fileName === '.env' || fileName.startsWith('.env.');
    if (isEnvironmentFile && !allowedEnvironmentFiles.has(repositoryPath)) {
      violations.push(`Arquivo de ambiente real não permitido no Git: ${repositoryPath}`);
    }

    if (forbiddenBackupSuffixes.some((suffix) => repositoryPath.endsWith(suffix))) {
      violations.push(`Arquivo temporário/backup não permitido: ${repositoryPath}`);
    }

    // Evita que dumps/acidentes muito grandes entrem sem revisão explícita.
    const sizeBytes = statSync(absolutePath).size;
    if (sizeBytes > 5 * 1024 * 1024) {
      violations.push(`Arquivo maior que 5 MB requer revisão: ${repositoryPath}`);
    }
  }
}

walk(repositoryRoot);

if (violations.length > 0) {
  console.error('\n❌ Repository hygiene gate falhou:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nCorrija os itens acima antes de integrar a mudança.\n');
  process.exit(1);
}

console.log('✅ Repository hygiene gate aprovado. Estrutura e arquivos sensíveis estão dentro do padrão.');
