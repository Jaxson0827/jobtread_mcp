const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const ACCOUNT_ID = '22NysTtFtcui'; // Warner's Construction
const JOB_ID = '22NysTtLh6LA';     // Mapleton Parks and Rec
const LOCATION_ID = '22NysTtKi3K7'; // 125 W 400 N (from prior probing)

async function safeFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { text, parsed, status: res.status };
}

async function probe(label, q) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  if (parsed && status === 200) {
    console.log(`✓ ${label}:\n`, JSON.stringify(parsed, null, 2).slice(0, 1500));
  } else {
    console.log(`✗ ${label} [${status}]: ${text.slice(0, 300)}`);
  }
  console.log('---');
}

// ── 1. account.locations directly ─────────────────────────────────────────────
await probe('account.locations directly', {
  account: {
    $: { id: ACCOUNT_ID },
    locations: {
      $: { size: 10 },
      nodes: { id: {}, name: {}, address: {}, formattedAddress: {}, city: {}, state: {}, postalCode: {}, country: {}, createdAt: {} }
    }
  }
});

// ── 2. job.location (singular) ────────────────────────────────────────────────
await probe('job.location singular', {
  job: {
    $: { id: JOB_ID },
    location: { id: {}, name: {}, address: {}, formattedAddress: {}, city: {}, state: {}, postalCode: {}, country: {}, createdAt: {}, latitude: {}, longitude: {} }
  }
});

// ── 3. job.locations (plural) ─────────────────────────────────────────────────
await probe('job.locations plural', {
  job: {
    $: { id: JOB_ID },
    locations: {
      $: { size: 10 },
      nodes: { id: {}, name: {}, address: {} }
    }
  }
});

// ── 4. location by ID — all fields ────────────────────────────────────────────
const locScalars = ['id','name','address','formattedAddress','city','state','postalCode',
  'country','latitude','longitude','createdAt','updatedAt','type','description','notes',
  'zip','region'];
console.log('── location scalar fields ──');
for (const f of locScalars) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      location: { $: { id: LOCATION_ID }, id: {}, [f]: {} }
    }}),
  });
  if (status === 200 && parsed?.location?.[f] !== undefined) {
    console.log(`✓ location.${f} = ${JSON.stringify(parsed.location[f])}`);
  } else if (status === 200 && parsed && !text.includes('does not exist')) {
    console.log(`? location.${f}: ${text.slice(0, 80)}`);
  } else {
    process.stdout.write(`✗ ${f}  `);
  }
}
console.log('\n---');

// ── 5. location relation fields ───────────────────────────────────────────────
const locRelations = ['account', 'contact', 'contacts', 'jobs', 'job', 'organization'];
console.log('── location relation fields ──');
for (const f of locRelations) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      location: { $: { id: LOCATION_ID }, id: {}, [f]: { id: {}, name: {} } }
    }}),
  });
  if (status === 200 && parsed?.location !== undefined && !text.includes('does not exist')) {
    console.log(`✓ location.${f} = ${JSON.stringify(parsed.location[f])}`);
  } else {
    process.stdout.write(`✗ ${f}  `);
  }
}
console.log('\n---');

// ── 6. createLocation params ──────────────────────────────────────────────────
// Existing: accountId + address. What else can we pass?
console.log('── createLocation optional params ──');
for (const [label, extra] of [
  ['name', { name: 'Test Site' }],
  ['city', { city: 'Mapleton' }],
  ['state', { state: 'UT' }],
  ['postalCode', { postalCode: '84664' }],
  ['zip', { zip: '84664' }],
  ['country', { country: 'US' }],
  ['latitude+longitude', { latitude: 40.1, longitude: -111.5 }],
  ['description', { description: 'Test desc' }],
  ['notes', { notes: 'Test notes' }],
  ['contactId', { contactId: '22NysTtH93vy' }],
]) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      createLocation: {
        $: { accountId: ACCOUNT_ID, address: '125 W 400 N, Mapleton, UT 84664', ...extra },
        createdLocation: { id: {}, name: {}, address: {}, city: {}, state: {}, postalCode: {} }
      }
    }}),
  });
  const id = parsed?.createLocation?.createdLocation?.id;
  if (id) {
    console.log(`✓ createLocation [${label}] accepted — id: ${id}, result: ${JSON.stringify(parsed.createLocation.createdLocation)}`);
    // clean up
    await safeFetch(PAVE, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query:{$:{grantKey:KEY},deleteLocation:{$:{id}}}}) });
  } else if (text.includes('no value is ever expected')) {
    console.log(`✗ createLocation [${label}] — invalid param`);
  } else {
    console.log(`~ createLocation [${label}]: ${text.slice(0, 200)}`);
  }
}
console.log('---');

// ── 7. org.locations ──────────────────────────────────────────────────────────
await probe('org.locations', {
  organization: {
    $: { id: ORG },
    locations: {
      $: { size: 5 },
      nodes: { id: {}, name: {}, address: {} }
    }
  }
});
