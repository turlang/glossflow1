import fs from 'node:fs';

const file = 'backend/src/routes/growth.routes.ts';
let text = fs.readFileSync(file, 'utf8');
const before = 'const professionals = appointments.reduce((acc: Record<string, number>, appointment: any) => {';
const after = 'const professionals = appointments.reduce<Record<string, number>>((acc, appointment) => {';
if (!text.includes(before)) throw new Error('Final explicit any marker not found.');
text = text.replace(before, after);
fs.writeFileSync(file, text, 'utf8');

const explicitAny = /\b(?:as\s+any\b|:\s*any\b|<any>|Record<[^>]*,\s*any>)/;
const offenders = [];
for (const entry of fs.readdirSync('backend/src/routes')) {
  if (!entry.endsWith('.ts')) continue;
  const source = fs.readFileSync(`backend/src/routes/${entry}`, 'utf8');
  if (explicitAny.test(source)) offenders.push(entry);
}
if (offenders.length) throw new Error(`Explicit any still present in routes: ${offenders.join(', ')}`);
console.log('Last explicit any removed from growth routes.');
