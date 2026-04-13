const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;

async function probe(label, q) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    const nodes = parsed?.organization?.jobs?.nodes;
    if (nodes !== undefined) {
      console.log(`✓ ${label}: returned ${nodes.length} jobs`);
    } else {
      console.log(`✗ ${label}:`, text.slice(0, 300));
    }
  } catch {
    console.log(`✗ ${label}: ${text.slice(0, 300)}`);
  }
}

// Can we filter by status server-side?
for (const status of ['created', 'approved', 'closed', 'paid', 'open', 'active']) {
  await probe(`jobs status filter: ${status}`, {
    organization: {
      $: { id: ORG },
      jobs: {
        $: { size: 100, status },
        nodes: { id: {}, name: {}, status: {} },
      },
    },
  });
}

// Try filters array syntax from spec
await probe('jobs filters array (spec syntax)', {
  organization: {
    $: { id: ORG },
    jobs: {
      $: { size: 100, filters: [{ status: { eq: 'created' } }] },
      nodes: { id: {}, name: {}, status: {} },
    },
  },
});
