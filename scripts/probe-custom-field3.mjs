const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;

// Try minimal customFieldValues to fit more items per page
for (const [size, cfSize] of [[25, 5], [50, 5], [50, 3], [75, 3], [100, 3], [100, 5]]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      organization: {
        $: { id: ORG },
        jobs: {
          $: { size },
          nodes: {
            id: {},
            name: {},
            customFieldValues: {
              $: { size: cfSize },
              nodes: { value: {}, customField: { name: {} } }
            }
          }
        }
      }
    }}),
  });
  const text = await res.text();
  if (res.status === 200) {
    const parsed = JSON.parse(text);
    console.log(`✓ jobs size=${size} cfSize=${cfSize}: ${parsed?.organization?.jobs?.nodes?.length} items, ${text.length} bytes`);
  } else {
    console.log(`✗ jobs size=${size} cfSize=${cfSize} [${res.status}]: ${text.slice(0, 80)}`);
  }
}
console.log('---');

// Check if the API supports batch entity fetching via object with different keys
// e.g., multiple job queries with different IDs in one request
const res2 = await fetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    jobA: { $: { id: '22NysTtLh6LA' }, name: {}, customFieldValues: { $: {size: 5}, nodes: { value: {}, customField: { name: {} } } } },
    jobB: { $: { id: '22NyvUBGq8Xa' }, name: {}, customFieldValues: { $: {size: 5}, nodes: { value: {}, customField: { name: {} } } } },
  }}),
});
const t2 = await res2.text();
console.log('batch with aliases [' + res2.status + ']:', t2.slice(0, 300));

// Also probe accounts with size=50 and minimal cfSize
for (const [size, cfSize] of [[25, 5], [50, 3], [100, 3]]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      organization: {
        $: { id: ORG },
        accounts: {
          $: { size },
          nodes: {
            id: {},
            name: {},
            type: {},
            customFieldValues: {
              $: { size: cfSize },
              nodes: { value: {}, customField: { name: {} } }
            }
          }
        }
      }
    }}),
  });
  const text = await res.text();
  if (res.status === 200) {
    const parsed = JSON.parse(text);
    console.log(`✓ accounts size=${size} cfSize=${cfSize}: ${parsed?.organization?.accounts?.nodes?.length} items, ${text.length} bytes`);
  } else {
    console.log(`✗ accounts size=${size} cfSize=${cfSize} [${res.status}]: ${text.slice(0, 80)}`);
  }
}
