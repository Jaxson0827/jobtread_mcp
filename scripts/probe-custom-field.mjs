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
    console.log(`✓ ${label}:\n`, JSON.stringify(parsed, null, 2).slice(0, 1000));
  } else {
    console.log(`✗ ${label} [${res.status}]: ${text.slice(0, 300)}`);
  }
  console.log('---');
  return parsed;
}

// ── 1. What custom fields exist in this org? ──────────────────────────────
await q('org.customFields', {
  organization: {
    $: { id: ORG },
    customFields: {
      $: { size: 50 },
      nodes: { id: {}, name: {}, type: {}, entityType: {} }
    }
  }
});

// ── 2. Can we filter org.jobs by customFieldValues? ───────────────────────
for (const [label, params] of [
  ['jobs with customFieldValues filter', {
    customFieldValues: { name: 'Lead Source', value: 'Referral' }
  }],
  ['jobs with customFieldValue param', {
    customFieldValue: 'Referral'
  }],
  ['jobs with where customFieldValues', {
    where: { customFieldValues: { name: 'Lead Source', value: 'Referral' } }
  }],
  ['jobs with filter param', {
    filter: { customFieldValues: { name: 'Lead Source', value: 'Referral' } }
  }],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      organization: {
        $: { id: ORG },
        jobs: { $: { size: 3, ...params }, nodes: { id: {}, name: {} } }
      }
    }}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200) {
    console.log(`✓ org.jobs [${label}]: ${parsed?.organization?.jobs?.nodes?.length} results`);
  } else {
    console.log(`✗ org.jobs [${label}] [${res.status}]: ${text.slice(0, 200)}`);
  }
}
console.log('---');

// ── 3. Can we filter org.accounts by customFieldValues? ───────────────────
for (const [label, params] of [
  ['accounts with where customFieldValues', {
    where: { customFieldValues: { name: 'Lead Source', value: 'Referral' } }
  }],
  ['accounts size 3 only', {}],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      organization: {
        $: { id: ORG },
        accounts: { $: { size: 3, ...params }, nodes: { id: {}, name: {} } }
      }
    }}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200) {
    console.log(`✓ org.accounts [${label}]: ${parsed?.organization?.accounts?.nodes?.length} results`);
  } else {
    console.log(`✗ org.accounts [${label}] [${res.status}]: ${text.slice(0, 200)}`);
  }
}
console.log('---');

// ── 4. Do org.jobs nodes have customFieldValues? ──────────────────────────
await q('org.jobs nodes with customFieldValues', {
  organization: {
    $: { id: ORG },
    jobs: {
      $: { size: 2 },
      nodes: {
        id: {},
        name: {},
        customFieldValues: {
          nodes: {
            value: {},
            customField: { id: {}, name: {}, type: {} }
          }
        }
      }
    }
  }
});

// ── 5. Do org.accounts nodes have customFieldValues? ─────────────────────
await q('org.accounts nodes with customFieldValues', {
  organization: {
    $: { id: ORG },
    accounts: {
      $: { size: 2 },
      nodes: {
        id: {},
        name: {},
        customFieldValues: {
          nodes: {
            value: {},
            customField: { id: {}, name: {}, type: {} }
          }
        }
      }
    }
  }
});

// ── 6. Probe customField direct query by name ─────────────────────────────
// Can we query entities that have a specific custom field value?
await q('org.customFields with entityType', {
  organization: {
    $: { id: ORG },
    customFields: {
      $: { size: 30 },
      nodes: {
        id: {},
        name: {},
        type: {},
        entityType: {},
      }
    }
  }
});

// ── 7. Can we fetch customFieldValues at the org level? ───────────────────
await q('org.customFieldValues', {
  organization: {
    $: { id: ORG },
    customFieldValues: {
      $: { size: 5 },
      nodes: {
        id: {},
        value: {},
        customField: { name: {} },
      }
    }
  }
});

// ── 8. Check what filter params org.jobs accepts ──────────────────────────
// Poke invalid params to see error messages that reveal valid ones
for (const param of ['name', 'status', 'search', 'query', 'customField', 'customFieldId', 'fieldValue']) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      organization: {
        $: { id: ORG },
        jobs: { $: { size: 1, [param]: 'test' }, nodes: { id: {} } }
      }
    }}),
  });
  const text = await res.text();
  if (res.status === 200) {
    process.stdout.write(`✓ jobs.$${param}  `);
  } else if (text.includes('no value is ever expected')) {
    process.stdout.write(`✗ ${param}  `);
  } else {
    console.log(`? jobs.$${param} [${res.status}]: ${text.slice(0, 150)}`);
  }
}
console.log('\n---');
