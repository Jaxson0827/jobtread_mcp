const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;

for (const cfSize of [8, 10, 15]) {
  const r = await fetch(PAVE, {
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
              $: { size: cfSize },
              nodes: { value: {}, customField: { name: {}, type: {} } }
            }
          }
        }
      }
    }}),
  });
  const t = await r.text();
  if (r.status === 200) {
    const p = JSON.parse(t);
    const jobs = p.organization.jobs.nodes;
    const totalCfv = jobs.reduce((sum, j) => sum + (j.customFieldValues?.nodes?.length ?? 0), 0);
    console.log(`✓ cfSize=${cfSize}: 100 jobs, ${totalCfv} cfv, ${t.length} bytes`);
  } else {
    console.log(`✗ cfSize=${cfSize} [${r.status}]: ${t.slice(0, 80)}`);
  }
}
