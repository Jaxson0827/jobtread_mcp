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
    console.log(`✓ ${label}:\n`, JSON.stringify(JSON.parse(text), null, 2).slice(0, 2000));
  } catch {
    console.log(`✗ ${label}: ${text.slice(0, 300)}`);
  }
  console.log('---');
}

// Get ALL users with size:100, check for email/type fields
await probe('users size:100 with email', {
  users: { $: { size: 100 }, nodes: { id: {}, name: {}, email: {} } }
});

await probe('users size:100 - name only', {
  users: { $: { size: 100 }, nodes: { id: {}, name: {} } }
});

// Check if users can be filtered by organizationId
await probe('users filtered by org', {
  users: { $: { size: 100, organizationId: ORG }, nodes: { id: {}, name: {} } }
});

// Check additional user fields
for (const field of ['email', 'type', 'role', 'active', 'firstName', 'lastName', 'phone', 'organizationId']) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      users: { $: { size: 3 }, nodes: { id: {}, [field]: {} } }
    }}),
  });
  const text = await res.text();
  if (!text.includes('does not exist') && !text.includes('invalid')) {
    console.log(`✓ user.${field}`);
  } else {
    console.log(`✗ user.${field}`);
  }
}
