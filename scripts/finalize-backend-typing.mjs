import fs from 'node:fs';
import path from 'node:path';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Marker not found: ${label}`);
  return text.replace(before, after);
}

// public-booking-availability.service.ts
{
  const file = 'backend/src/services/public-booking-availability.service.ts';
  let text = read(file);
  text = replaceRequired(text, 'type RankedSlot = {', 'export type RankedSlot = {', 'RankedSlot export');
  text = replaceRequired(
    text,
    "type BusyInterval = { startTime: Date; endTime: Date; professionalId: string };\ntype FreeBlock = { start: Date; end: Date };",
    "type BusyInterval = { startTime: Date; endTime: Date; professionalId: string };\ntype FreeBlock = { start: Date; end: Date };\ntype PublicProfessionalInput = { id: string; name: string; specialty: string; photoUrl: string | null };",
    'PublicProfessionalInput insertion'
  );
  text = replaceRequired(text, 'function publicProfessional(professional: any) {', 'function publicProfessional(professional: PublicProfessionalInput) {', 'publicProfessional type');
  write(file, text);
}

// waitlist.service.ts
{
  const file = 'backend/src/services/waitlist.service.ts';
  let text = read(file);
  text = replaceRequired(
    text,
    "import { publicBookingAvailability } from './public-booking-availability.service';",
    "import { publicBookingAvailability, RankedSlot } from './public-booking-availability.service';",
    'waitlist availability import'
  );
  const marker = "const OFFER_MINUTES = Number(process.env.WAITLIST_OFFER_MINUTES || 20);";
  text = replaceRequired(text, marker, `${marker}\n\ntype WaitlistCandidateSlot = RankedSlot & { professionalId: string; professionalName: string };`, 'waitlist slot contract');
  text = replaceRequired(text, '    slot: any;', '    slot: WaitlistCandidateSlot;', 'waitlist candidate slot');
  write(file, text);
}

// whatsapp.service.ts
{
  const file = 'backend/src/services/whatsapp.service.ts';
  let text = read(file);
  const before = `function metaErrorDetails(data: any) {
  const error = data?.error || {};
  return {
    errorCode: Number(error.code || 0) || null,
    errorSubcode: Number(error.error_subcode || 0) || null,
    errorType: String(error.type || ''),
    errorMessage: String(error.message || ''),
    fbtraceId: String(error.fbtrace_id || '')
  };
}`;
  const after = `function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function metaErrorDetails(data: unknown) {
  const error = asRecord(asRecord(data).error);
  return {
    errorCode: Number(error.code || 0) || null,
    errorSubcode: Number(error.error_subcode || 0) || null,
    errorType: String(error.type || ''),
    errorMessage: String(error.message || ''),
    fbtraceId: String(error.fbtrace_id || '')
  };
}`;
  text = replaceRequired(text, before, after, 'Meta error narrowing');
  write(file, text);
}

// business.routes.ts
{
  const file = 'backend/src/routes/business.routes.ts';
  let text = read(file);
  const before = `          const data = await aiResponse.json() as any;
          const connectedAnswer = data?.choices?.[0]?.message?.content?.trim();
          if (connectedAnswer) answer = connectedAnswer;`;
  const after = `          const rawResponse: unknown = await aiResponse.json();
          const parsedResponse = z.object({
            choices: z.array(z.object({
              message: z.object({ content: z.string().optional().nullable() })
            })).optional().default([])
          }).safeParse(rawResponse);
          const connectedAnswer = parsedResponse.success
            ? parsedResponse.data.choices[0]?.message.content?.trim()
            : undefined;
          if (connectedAnswer) answer = connectedAnswer;`;
  text = replaceRequired(text, before, after, 'OpenAI response validation');
  write(file, text);
}

const explicitAny = /\b(?:as\s+any\b|:\s*any\b|<any>|Record<[^>]*,\s*any>)/;
const offenders = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.ts')) {
      read(full).split(/\r?\n/).forEach((line, index) => {
        if (explicitAny.test(line)) offenders.push(`${full}:${index + 1}: ${line.trim()}`);
      });
    }
  }
}
walk('backend/src');
write('backend-any-report.txt', offenders.length ? offenders.join('\n') + '\n' : 'ZERO_EXPLICIT_ANY\n');
console.log(offenders.length ? `Backend typing migration applied; ${offenders.length} explicit any occurrence(s) remain.` : 'Backend typing finalized: zero explicit any.');
