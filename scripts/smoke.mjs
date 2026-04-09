// Quick smoke test of the compiled API functions
import { paveQuery } from '../lib/jobtread/client.js';

const ORG = process.env.JOBTREAD_ORG_ID;

// 1: search all jobs
const jobsData = await paveQuery({
  organization: {
    $: { id: ORG },
    jobs: { nodes: { id: {}, name: {}, status: {}, number: {} } },
  },
});
const jobs = jobsData.organization.jobs.nodes;
console.log(`✓ searchJobs: found ${jobs.length} jobs`);
console.log('  First job:', jobs[0]);

// 2: get single job
const jobId = jobs[0].id;
const jobData = await paveQuery({
  job: {
    $: { id: jobId },
    id: {},
    name: {},
    status: {},
    description: {},
    location: { id: {}, address: {}, city: {}, state: {} },
  },
});
console.log(`\n✓ getJob: ${jobData.job.name}`);
console.log('  location:', jobData.job.location);

// 3: get accounts
const acctData = await paveQuery({
  organization: {
    $: { id: ORG },
    accounts: { nodes: { id: {}, name: {}, type: {} } },
  },
});
const accounts = acctData.organization.accounts.nodes;
console.log(`\n✓ searchAccounts: found ${accounts.length} accounts`);
console.log('  First account:', accounts[0]);

// 4: get job costItems
const costData = await paveQuery({
  job: {
    $: { id: jobId },
    costItems: { nodes: { id: {}, name: {}, cost: {}, price: {} } },
  },
});
const items = costData.job.costItems.nodes;
console.log(`\n✓ getJobCostItems: found ${items.length} items`);
if (items[0]) console.log('  First item:', items[0]);

// 5: get job time entries
const timeData = await paveQuery({
  job: { $: { id: jobId }, timeEntries: { nodes: { id: {}, minutes: {}, startedAt: {} } } },
});
const entries = timeData.job.timeEntries.nodes;
console.log(`\n✓ getTimeEntries: found ${entries.length} entries`);

// 6: get daily logs
const logData = await paveQuery({
  job: { $: { id: jobId }, dailyLogs: { nodes: { id: {}, date: {}, notes: {} } } },
});
const logs = logData.job.dailyLogs.nodes;
console.log(`\n✓ getDailyLogs: found ${logs.length} logs`);
if (logs[0]) console.log('  First log:', { date: logs[0].date, notes: logs[0].notes?.slice(0, 60) });

console.log('\n✅ All smoke tests passed!');
