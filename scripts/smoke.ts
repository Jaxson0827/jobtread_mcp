import { searchJobs, getJob } from '../lib/jobtread/jobs.js';
import { searchAccounts, getAccount } from '../lib/jobtread/accounts.js';
import { getJobCostSummary } from '../lib/jobtread/budgets.js';
import { getTimeEntries, getDailyLogs } from '../lib/jobtread/time.js';
import { listDocuments } from '../lib/jobtread/documents.js';

console.log('=== Phase 2 Smoke Test ===\n');

const jobs = await searchJobs();
console.log(`✓ searchJobs: found ${jobs.length} jobs`);
console.log('  Sample:', jobs.slice(0, 3).map((j) => `[${j.status}] ${j.name}`).join(', '));

const openJobs = await searchJobs('Enduro');
console.log(`\n✓ searchJobs("Enduro"): found ${openJobs.length} matches`);

const jobId = jobs[0]?.id!;
const job = await getJob(jobId);
console.log(`\n✓ getJob(${jobId}): ${job.name}`);
console.log('  status:', job.status);
console.log('  location:', job.location?.formattedAddress);

const accounts = await searchAccounts();
console.log(`\n✓ searchAccounts: found ${accounts.length} accounts`);
const customers = await searchAccounts(undefined, 'customer');
console.log(`✓ searchAccounts(customer): ${customers.length} customers`);
const byName = await searchAccounts('metal');
console.log(`✓ searchAccounts("metal"): ${byName.length} matches →`, byName.map((a) => a.name).join(', '));

if (accounts[0]?.id) {
  const acct = await getAccount(accounts[0].id);
  console.log(`\n✓ getAccount: ${acct.name} (${acct.type})`);
  console.log('  primaryContact:', acct.primaryContact?.name ?? 'none');
  console.log('  contacts count:', acct.contacts?.nodes?.length ?? 0);
}

const costSummary = await getJobCostSummary(jobId);
console.log(`\n✓ getJobCostSummary(${jobId}): ${costSummary.itemCount} items`);
console.log(`  totalCost: $${costSummary.totalCost}, totalPrice: $${costSummary.totalPrice}`);

const timeEntries = await getTimeEntries(jobId);
console.log(`\n✓ getTimeEntries: ${timeEntries.length} entries`);
if (timeEntries[0]) {
  console.log('  First entry: startedAt', timeEntries[0].startedAt, 'minutes:', timeEntries[0].minutes);
}

const dailyLogs = await getDailyLogs(jobId);
console.log(`\n✓ getDailyLogs: ${dailyLogs.length} logs`);
if (dailyLogs[0]) {
  console.log('  First log date:', dailyLogs[0].date, '| notes:', dailyLogs[0].notes?.slice(0, 60));
}

const documents = await listDocuments(jobId);
console.log(`\n✓ listDocuments: ${documents.length} documents`);
if (documents[0]) {
  console.log('  First doc:', documents[0].name, `(${documents[0].type}, ${documents[0].status})`);
}

console.log('\n✅ All Phase 2 smoke tests passed!');
