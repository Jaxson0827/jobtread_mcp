/**
 * Integration test for the new batch of tools.
 * Run with: npx tsx scripts/test-misc.ts
 */
import { getActiveJobs, getJobFiles } from '../lib/jobtread/jobs.js';
import { getCostItemById, getUnits, getCostCodes, getCostTypes } from '../lib/jobtread/budgets.js';
import { getTimeEntryById, getOrgTimeEntries, getTimeEntries } from '../lib/jobtread/time.js';

const TEST_JOB_ID = '22NysTtLh6LA'; // Mapleton Parks and Rec
let passed = 0;
let failed = 0;

function assert(label: string, value: unknown, check: (v: unknown) => boolean) {
  if (check(value)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(value)}`);
    failed++;
  }
}

// ── getActiveJobs ─────────────────────────────────────────────────────────────
console.log('\n── getActiveJobs ──');
const active = await getActiveJobs();
assert('returns array', active, (v) => Array.isArray(v));
assert('all have status created/approved', active, (v) =>
  (v as typeof active).every((j) => j.status === 'created' || j.status === 'approved')
);
assert('sorted newest first', active, (v) => {
  const arr = v as typeof active;
  if (arr.length < 2) return true;
  return new Date(arr[0].createdAt!).getTime() >= new Date(arr[arr.length - 1].createdAt!).getTime();
});
console.log(`  Active jobs: ${active.length}`);
if (active.length > 0) console.log(`  First: ${active[0].name} (${active[0].status})`);

// ── getJobFiles ───────────────────────────────────────────────────────────────
console.log('\n── getJobFiles ──');
const files = await getJobFiles(TEST_JOB_ID);
assert('returns array', files, (v) => Array.isArray(v));
assert('at least 1 file', files, (v) => (v as unknown[]).length > 0);
const f0 = files[0];
assert('file has id', f0?.id, (v) => typeof v === 'string');
assert('file has name', f0?.name, (v) => typeof v === 'string');
assert('file has url', f0?.url, (v) => typeof v === 'string' && (v as string).startsWith('https://'));
assert('file has type', f0?.type, (v) => typeof v === 'string');
assert('file has createdAt', f0?.createdAt, (v) => typeof v === 'string');
console.log(`  Files: ${files.length} | first: ${f0?.name} (${f0?.type})`);

// ── getCostItemById ───────────────────────────────────────────────────────────
console.log('\n── getCostItemById ──');
const COST_ITEM_ID = '22NysUkVvRsQ';
const ci = await getCostItemById(COST_ITEM_ID);
assert('has id', ci.id, (v) => v === COST_ITEM_ID);
assert('has name', ci.name, (v) => typeof v === 'string');
assert('has cost', ci.cost, (v) => typeof v === 'number');
assert('has costCode', ci.costCode?.name, (v) => typeof v === 'string');
assert('has costType', ci.costType?.name, (v) => typeof v === 'string');
assert('has unit', ci.unit?.name, (v) => typeof v === 'string');
console.log(`  ${ci.name} | qty: ${ci.quantity} | costCode: ${ci.costCode?.name} | unit: ${ci.unit?.name}`);

// ── getUnits ──────────────────────────────────────────────────────────────────
console.log('\n── getUnits ──');
const units = await getUnits();
assert('returns array', units, (v) => Array.isArray(v));
assert('at least 5 units', units, (v) => (v as unknown[]).length >= 5);
assert('has Hours', units, (v) => (v as typeof units).some((u) => u.name === 'Hours'));
assert('has Square Feet', units, (v) => (v as typeof units).some((u) => u.name === 'Square Feet'));
console.log(`  Units: ${units.map((u) => u.name).join(', ')}`);

// ── getCostCodes + getCostTypes ───────────────────────────────────────────────
console.log('\n── getCostCodes + getCostTypes ──');
const [codes, types] = await Promise.all([getCostCodes(), getCostTypes()]);
assert('codes array', codes, (v) => Array.isArray(v) && (v as unknown[]).length > 0);
assert('types array', types, (v) => Array.isArray(v) && (v as unknown[]).length > 0);
assert('types include Labor', types, (v) => (v as typeof types).some((t) => t.name === 'Labor'));
console.log(`  Cost types: ${types.map((t) => t.name).join(', ')}`);
console.log(`  Cost codes: ${codes.length} codes`);

// ── getTimeEntryById ──────────────────────────────────────────────────────────
console.log('\n── getTimeEntryById ──');
const entries = await getTimeEntries(TEST_JOB_ID);
assert('has time entries', entries, (v) => (v as unknown[]).length > 0);
const TIME_ENTRY_ID = entries[0].id!;
const te = await getTimeEntryById(TIME_ENTRY_ID);
assert('has id', te.id, (v) => v === TIME_ENTRY_ID);
assert('has minutes', te.minutes, (v) => typeof v === 'number');
assert('has startedAt', te.startedAt, (v) => typeof v === 'string');
assert('has user', te.user?.name, (v) => typeof v === 'string');
assert('has job relation', te.job?.id, (v) => typeof v === 'string');
console.log(`  ${te.user?.name} | ${te.minutes}min | job: ${te.job?.name}`);

// ── getOrgTimeEntries ─────────────────────────────────────────────────────────
console.log('\n── getOrgTimeEntries ──');
const orgEntries = await getOrgTimeEntries();
assert('returns array', orgEntries, (v) => Array.isArray(v));
assert('at least 1 entry', orgEntries, (v) => (v as unknown[]).length > 0);
const oe0 = orgEntries[0];
assert('org entry has minutes', oe0?.minutes, (v) => typeof v === 'number');
assert('org entry has user', oe0?.user, (v) => typeof v === 'object' && v !== null);
// job may be null for some entries (API returns null for orphaned entries)
const totalOrgMinutes = orgEntries.reduce((s, e) => s + (e.minutes ?? 0), 0);
const uniqueUsers = new Set(orgEntries.map((e) => e.user?.id).filter(Boolean));
const uniqueJobs = new Set(orgEntries.map((e) => e.job?.id).filter(Boolean));
console.log(`  ${orgEntries.length} entries | ${(totalOrgMinutes/60).toFixed(1)}h total | ${uniqueUsers.size} users | ${uniqueJobs.size} jobs`);

console.log('\n────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
