/**
 * Live integration test for copy_budget and list_users tools.
 * Run: npx tsx scripts/test-new-tools.ts
 */

import { listUsers } from '../lib/jobtread/users.js';
import { getJobCostItems, createCostItem, deleteCostItem } from '../lib/jobtread/budgets.js';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`, detail ?? '');
    failed++;
  }
}

// ── list_users ─────────────────────────────────────────────────────────────
console.log('\n── list_users ──');
const users = await listUsers();
console.log(`  Returned ${users.length} users`);
assert('returns array', Array.isArray(users));
assert('each user has id', users.every((u) => typeof u.id === 'string' && u.id.length > 0));
assert('each user has name', users.every((u) => typeof u.name === 'string' && u.name.length > 0));
assert('at least one human user visible', users.some((u) =>
  !['Stripe', 'QuickBooks Online', 'QuickBooks Desktop', 'JobTread', 'CompanyCam', 'Plaid', 'Web Form', 'EVO', 'Hover', 'RENDR', 'EagleView'].includes(u.name)
));
const humanUsers = users.filter((u) => u.name.includes(' '));
console.log(`  Human-looking users: ${humanUsers.map((u) => u.name).join(', ')}`);

// ── copy_budget (dry run — copy to itself then delete copies) ──────────────
console.log('\n── copy_budget (source job: Mapleton Parks and Rec) ──');
const SOURCE_JOB = '22NysTtLh6LA';

// Get source items first
const sourceItems = await getJobCostItems(SOURCE_JOB);
console.log(`  Source job has ${sourceItems.length} cost items`);
assert('source has cost items', sourceItems.length > 0);

if (sourceItems.length > 0) {
  const sample = sourceItems[0];
  console.log(`  First item: "${sample.name}" | costCode: ${sample.costCode?.name} | costType: ${sample.costType?.name}`);
  assert('costCode.id available', typeof sample.costCode?.id === 'string');
  assert('costType.id available', typeof sample.costType?.id === 'string');

  // Create a copy of just the first item on the same job to test createCostItem path
  console.log('\n  Testing copy: create one item, then delete it...');
  let createdId: string | undefined;
  try {
    const created = await createCostItem({
      jobId: SOURCE_JOB,
      name: `[TEST COPY] ${sample.name}`,
      quantity: sample.quantity ?? 1,
      unitCost: sample.unitCost ?? 0,
      unitPrice: sample.unitPrice ?? 0,
      costCodeId: sample.costCode!.id!,
      costTypeId: sample.costType!.id!,
    });
    createdId = created.id;
    assert('copy created successfully', !!created.id, created);
    console.log(`    Created item ID: ${created.id}, name: ${created.name}`);
  } catch (e) {
    assert('copy created successfully', false, (e as Error).message);
  }

  // Clean up
  if (createdId) {
    try {
      await deleteCostItem(createdId);
      assert('test item cleaned up', true);
      console.log(`    Cleaned up ${createdId}`);
    } catch (e) {
      assert('test item cleaned up', false, (e as Error).message);
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
