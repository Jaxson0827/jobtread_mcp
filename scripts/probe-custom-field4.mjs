const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;

// Test 100 jobs WITHOUT a size limit on customFieldValues
const r1 = await fetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    organization: {
      $: { id: ORG },
      jobs: {
        $: { size: 100 },
        nodes: {
          id: {}, name: {}, status: {},
          customFieldValues: {
            nodes: { value: {}, customField: { name: {}, type: {} } }
          }
        }
      }
    }
  }}),
});
const t1 = await r1.text();
if (r1.status === 200) {
  const p = JSON.parse(t1);
  const jobs = p.organization.jobs.nodes;
  const totalCfv = jobs.reduce((sum, j) => sum + (j.customFieldValues?.nodes?.length ?? 0), 0);
  console.log(`✓ 100 jobs no cfSize: ${jobs.length} jobs, ${totalCfv} total cfv, ${t1.length} bytes`);
  // Print cfv counts per job for insight
  for (const j of jobs.slice(0, 5)) {
    console.log(`  ${j.name}: ${j.customFieldValues?.nodes?.length} cfv`);
  }
} else {
  console.log(`✗ [${r1.status}]: ${t1.slice(0, 200)}`);
}

// Test 100 accounts WITHOUT a size limit on customFieldValues
const r2 = await fetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    organization: {
      $: { id: ORG },
      accounts: {
        $: { size: 100 },
        nodes: {
          id: {}, name: {}, type: {},
          customFieldValues: {
            nodes: { value: {}, customField: { name: {}, type: {} } }
          }
        }
      }
    }
  }}),
});
const t2 = await r2.text();
if (r2.status === 200) {
  const p = JSON.parse(t2);
  const accounts = p.organization.accounts.nodes;
  const totalCfv = accounts.reduce((sum, a) => sum + (a.customFieldValues?.nodes?.length ?? 0), 0);
  console.log(`✓ 100 accounts no cfSize: ${accounts.length} accounts, ${totalCfv} total cfv, ${t2.length} bytes`);
} else {
  console.log(`✗ accounts [${r2.status}]: ${t2.slice(0, 200)}`);
}
