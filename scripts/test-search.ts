/**
 * Integration test for search_by_custom_field.
 * Run: npx tsx scripts/test-search.ts
 */
import {
  searchJobsByCustomField,
  searchAccountsByCustomField,
} from '../lib/jobtread/search.js';

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

// ── 1. Search jobs by Job Type ─────────────────────────────────────────────
console.log('\n[1] searchJobsByCustomField — Job Type = Misc Metals');
const jobMatches = await searchJobsByCustomField('Job Type', 'Misc Metals');
assert('returns array', Array.isArray(jobMatches));
assert('found at least one match', jobMatches.length > 0);
if (jobMatches.length > 0) {
  const m = jobMatches[0];
  assert('match has id', m.id);
  assert('match has name', m.name);
  assert('entityType is job', m.entityType, 'job');
  assert('matchedField is Job Type', m.matchedField, 'Job Type');
  assert('matchedValue contains Misc Metals', m.matchedValue.toLowerCase().includes('misc metals'));
  console.log(`  → matched: "${m.name}" — Job Type = "${m.matchedValue}"`);
}

// ── 2. Partial match ────────────────────────────────────────────────────────
console.log('\n[2] searchJobsByCustomField — Job Type = misc (partial)');
const partialMatches = await searchJobsByCustomField('Job Type', 'misc');
assert('partial match works', partialMatches.length > 0);

// ── 3. Case-insensitive match ───────────────────────────────────────────────
console.log('\n[3] searchJobsByCustomField — Job Type = MISC METALS (uppercase)');
const caseMatches = await searchJobsByCustomField('Job Type', 'MISC METALS');
assert('case-insensitive match works', caseMatches.length > 0);

// ── 4. No match ──────────────────────────────────────────────────────────────
console.log('\n[4] searchJobsByCustomField — nonexistent field');
const noMatch = await searchJobsByCustomField('Nonexistent Field', 'xyz');
assert('empty result for unknown field', noMatch.length, 0);

// ── 5. Search accounts by W-9 ────────────────────────────────────────────────
console.log('\n[5] searchAccountsByCustomField — W-9 = false');
const acctMatches = await searchAccountsByCustomField('W-9', 'false');
assert('returns array', Array.isArray(acctMatches));
// W-9 might not be set on all accounts, but if any have it set to false, we should find them
console.log(`  → found ${acctMatches.length} account(s) with W-9 = false`);
if (acctMatches.length > 0) {
  const m = acctMatches[0];
  assert('entityType is account', m.entityType, 'account');
  assert('matchedField is W-9', m.matchedField, 'W-9');
}

// ── 6. Search accounts by Lead Source ────────────────────────────────────────
console.log('\n[6] searchAccountsByCustomField — Lead Source');
const leadMatches = await searchAccountsByCustomField('Lead Source', 'Referral');
assert('returns array', Array.isArray(leadMatches));
console.log(`  → found ${leadMatches.length} account(s) with Lead Source = Referral`);

// ── 7. Verify result structure ────────────────────────────────────────────────
console.log('\n[7] searchJobsByCustomField — Status field');
const statusMatches = await searchJobsByCustomField('Status', 'Payment');
assert('returns array', Array.isArray(statusMatches));
console.log(`  → found ${statusMatches.length} job(s) with Status containing "Payment"`);
if (statusMatches.length > 0) {
  const m = statusMatches[0];
  assert('has id', m.id);
  assert('has name', m.name);
  assert('has status', m.status);
  assert('entityType is job', m.entityType, 'job');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n══ Results: ${pass} passed, ${fail} failed ══`);
if (fail > 0) process.exit(1);
