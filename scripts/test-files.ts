/**
 * Integration test for file management tools.
 * Run: npx tsx scripts/test-files.ts
 */
import { getJobFiles } from '../lib/jobtread/jobs.js';
import { getFileById, updateFile } from '../lib/jobtread/files.js';

const JOB_ID = '22NysTtLh6LA'; // Mapleton Parks and Rec
let FILE_ID = '22NysbGPxsX4'; // image.jpg

let pass = 0;
let fail = 0;

function assert(label: string, value: unknown, expected?: unknown) {
  const ok =
    expected === undefined ? Boolean(value) : JSON.stringify(value) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(value)}`);
    fail++;
  }
}

// ── 1. getJobFiles ─────────────────────────────────────────────────────────
console.log('\n[1] getJobFiles');
const files = await getJobFiles(JOB_ID);
assert('returns array', Array.isArray(files));
assert('has items', files.length > 0);
const first = files[0];
assert('has id', first?.id);
assert('has name', first?.name);
assert('has url', first?.url);
assert('has type', first?.type);
assert('has size (number)', typeof first?.size === 'number');
assert('has createdAt', first?.createdAt);
FILE_ID = first!.id!;
console.log(`  → found ${files.length} files; using FILE_ID=${FILE_ID}`);

// ── 2. getFileById ─────────────────────────────────────────────────────────
console.log('\n[2] getFileById');
const detail = await getFileById(FILE_ID);
assert('has id', detail.id);
assert('id matches', detail.id, FILE_ID);
assert('has name', detail.name);
assert('has url', detail.url);
assert('has type', detail.type);
assert('has size', typeof detail.size === 'number');
assert('has createdAt', detail.createdAt);
assert('has job.id', (detail as Record<string, unknown> & { job?: { id?: string } }).job?.id);
assert('has job.name', (detail as Record<string, unknown> & { job?: { name?: string } }).job?.name);
console.log(`  → file: "${detail.name}" (${detail.type}, ${detail.size} bytes)`);
console.log(`  → url: ${detail.url?.slice(0, 60)}…`);

// ── 3. updateFile (name + description) ────────────────────────────────────
console.log('\n[3] updateFile — set description');
const originalName = detail.name!;
const updated1 = await updateFile({ id: FILE_ID, description: 'Test description from MCP probe' });
assert('update returns id', updated1.id, FILE_ID);
assert('description set', updated1.description, 'Test description from MCP probe');
assert('name unchanged', updated1.name, originalName);

// ── 4. updateFile — clear description ─────────────────────────────────────
console.log('\n[4] updateFile — clear description');
const updated2 = await updateFile({ id: FILE_ID, description: null });
assert('update returns id', updated2.id, FILE_ID);
// description null or empty string both mean cleared
assert('description cleared', updated2.description == null || updated2.description === '');

// ── 5. getFileById on nonexistent ID ──────────────────────────────────────
console.log('\n[5] getFileById — nonexistent ID');
try {
  const none = await getFileById('00000000fake');
  assert('returns empty on bad id', !none.id || none.id === '');
} catch {
  // API throws on invalid ID format — also acceptable
  assert('throws or returns empty on bad id', true);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n══ Results: ${pass} passed, ${fail} failed ══`);
if (fail > 0) process.exit(1);
