const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;

async function q(label, body) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...body } }),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200) {
    const jobCount = parsed?.organization?.jobs?.nodes?.length ?? parsed?.organization?.accounts?.nodes?.length;
    console.log(`✓ ${label}: ${jobCount} items, response_len=${text.length}`);
  } else {
    console.log(`✗ ${label} [${res.status}]: ${text.slice(0, 200)}`);
  }
  return parsed;
}

// Test various sizes with customFieldValues to find the safe limit
for (const size of [10, 25, 50, 75, 100]) {
  await q(`org.jobs size=${size} with customFieldValues`, {
    organization: {
      $: { id: ORG },
      jobs: {
        $: { size },
        nodes: {
          id: {},
          name: {},
          status: {},
          customFieldValues: {
            $: { size: 20 },
            nodes: {
              value: {},
              customField: { name: {}, type: {} }
            }
          }
        }
      }
    }
  });
}

console.log('---');

for (const size of [10, 25, 50, 75, 100]) {
  await q(`org.accounts size=${size} with customFieldValues`, {
    organization: {
      $: { id: ORG },
      accounts: {
        $: { size },
        nodes: {
          id: {},
          name: {},
          type: {},
          customFieldValues: {
            $: { size: 20 },
            nodes: {
              value: {},
              customField: { name: {}, type: {} }
            }
          }
        }
      }
    }
  });
}

console.log('---');

// Check org.customFields (no entityType)
const res = await fetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    organization: {
      $: { id: ORG },
      customFields: {
        $: { size: 50 },
        nodes: { id: {}, name: {}, type: {} }
      }
    }
  }}),
});
const text = await res.text();
const parsed = JSON.parse(text);
console.log('org.customFields:', JSON.stringify(parsed?.organization?.customFields?.nodes, null, 2));
