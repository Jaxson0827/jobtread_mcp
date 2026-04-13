/**
 * Integration test for contact tools.
 * Run with: npx tsx scripts/test-contacts.ts
 */
import {
  getAccountContacts,
  getContactById,
  createContactForAccount,
  extractCustomFieldValue,
} from '../lib/jobtread/accounts.js';

const TEST_ACCOUNT_ID = '22NysTtFtcui'; // Warner's Construction
let passed = 0;
let failed = 0;
let createdContactId: string | null = null;

function assert(label: string, value: unknown, check: (v: unknown) => boolean) {
  if (check(value)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(value)}`);
    failed++;
  }
}

console.log('\n── getAccountContacts ──');
const contacts = await getAccountContacts(TEST_ACCOUNT_ID);
assert('returns array', contacts, (v) => Array.isArray(v));
assert('at least 1 contact', contacts, (v) => (v as unknown[]).length > 0);

const first = contacts[0];
assert('contact has id', first?.id, (v) => typeof v === 'string' && (v as string).length > 0);
assert('contact has name', first?.name, (v) => typeof v === 'string' && (v as string).length > 0);
assert('contact has createdAt', first?.createdAt, (v) => typeof v === 'string');
assert('contact has customFieldValues', first?.customFieldValues, (v) => v != null && typeof v === 'object');
// locations are only included in getContactById (detail), not list queries
console.log(`  Sample: ${first?.name} | title: ${first?.title ?? 'none'}`);

// Check a contact with email/phone (Rob Burr from prior probe)
const robBurr = contacts.find((c) => c.name === 'Rob Burr');
if (robBurr) {
  const email = extractCustomFieldValue(robBurr, 'Email');
  const phone = extractCustomFieldValue(robBurr, 'Phone');
  assert('Rob Burr email extracted', email, (v) => typeof v === 'string' && (v as string).includes('@'));
  assert('Rob Burr phone extracted', phone, (v) => typeof v === 'string' && (v as string).length > 0);
  console.log(`  Rob Burr email: ${email}, phone: ${phone}`);
} else {
  console.log('  (Rob Burr not in first account — skipping email/phone extract test)');
}

console.log('\n── getContactById ──');
const detail = await getContactById(first.id!);
assert('detail has id', detail.id, (v) => v === first.id);
assert('detail has name', detail.name, (v) => typeof v === 'string');
assert('detail has account relation', detail.account?.id, (v) => typeof v === 'string');
console.log(`  Account: ${detail.account?.name}`);

console.log('\n── createContactForAccount ──');
const newContact = await createContactForAccount({
  accountId: TEST_ACCOUNT_ID,
  name: 'MCP Test Contact',
  title: 'QA Tester',
  email: 'mcp-test@example.com',
  phone: '801-555-0000',
  leadSource: 'Referral',
});
assert('created contact has id', newContact.id, (v) => typeof v === 'string' && (v as string).length > 0);
assert('created name matches', newContact.name, (v) => v === 'MCP Test Contact');
assert('created title matches', newContact.title, (v) => v === 'QA Tester');
createdContactId = newContact.id ?? null;
console.log(`  Created id: ${createdContactId}`);

if (newContact.id) {
  const email = extractCustomFieldValue(newContact, 'Email');
  const phone = extractCustomFieldValue(newContact, 'Phone');
  assert('email stored in customFieldValues', email, (v) => v === 'mcp-test@example.com');
  assert('phone stored in customFieldValues', phone, (v) => typeof v === 'string' && (v as string).length > 0);
  console.log(`  Email: ${email}, Phone: ${phone}`);
}

console.log('\n── verify new contact appears in list ──');
const refreshed = await getAccountContacts(TEST_ACCOUNT_ID);
assert('new contact appears in account contacts', refreshed.some((c) => c.id === createdContactId), (v) => v === true);

console.log('\n────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (createdContactId) {
  console.log(`\nNOTE: Test contact ${createdContactId} ("MCP Test Contact") was created on account ${TEST_ACCOUNT_ID}.`);
  console.log('Delete it manually in the JobTread web interface if needed.');
}

if (failed > 0) process.exit(1);
