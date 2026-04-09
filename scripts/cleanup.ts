import { paveQuery } from '../lib/jobtread/client.js';

// IDs from the latest integration test run
const ids = [
  ['deleteCostItem', '22PVGtMTcr9h'],
  ['deleteTimeEntry', '22PVGtMZT7dE'],
  ['deleteDailyLog', '22PVGtMaQJZP'],
  ['deleteAccount', '22PVGtMdjdM4'],
];

for (const [mutation, id] of ids) {
  try {
    await paveQuery({ [mutation]: { $: { id } } });
    console.log(`✓ ${mutation} ${id}`);
  } catch (e) {
    console.log(`✗ ${mutation} ${id}: ${(e as Error).message}`);
  }
}
