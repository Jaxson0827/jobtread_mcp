const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const JOB_ID = '22NysTtLh6LA';
const COST_ITEM_ID = '22NysUkVvRsQ';

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

// ── 1. job.folders — what scalar does it return? ──────────────────────────────
await probe('job.folders scalar', {
  job: { $: { id: JOB_ID }, id: {}, folders: {} }
});

// ── 2. costItem.unit with sub-fields ──────────────────────────────────────────
await probe('costItem.unit fields', {
  costItem: {
    $: { id: COST_ITEM_ID },
    id: {}, name: {},
    unit: { id: {}, name: {} }
  }
});

// ── 3. org.units with all fields ─────────────────────────────────────────────
await probe('org.units full', {
  organization: {
    $: { id: ORG },
    units: {
      $: { size: 50 },
      nodes: { id: {}, name: {} }
    }
  }
});

// ── 4. org.timeEntries with filter params ─────────────────────────────────────
// Try jobId filter
await probe('org.timeEntries filter jobId', {
  organization: {
    $: { id: ORG },
    timeEntries: {
      $: { size: 5, jobId: JOB_ID },
      nodes: { id: {}, minutes: {}, startedAt: {}, user: { id: {}, name: {} }, job: { id: {}, name: {} } }
    }
  }
});

// Try userId filter
await probe('org.timeEntries filter userId', {
  organization: {
    $: { id: ORG },
    timeEntries: {
      $: { size: 5, userId: '22NysRKg27AW' },
      nodes: { id: {}, minutes: {}, startedAt: {}, user: { id: {}, name: {} }, job: { id: {}, name: {} } }
    }
  }
});

// Try date range filters
await probe('org.timeEntries date range', {
  organization: {
    $: { id: ORG },
    timeEntries: {
      $: { size: 5, startedAfter: '2025-01-01T00:00:00Z', startedBefore: '2026-01-01T00:00:00Z' },
      nodes: { id: {}, minutes: {}, startedAt: {}, user: { id: {}, name: {} } }
    }
  }
});

// ── 5. job.files full fields ──────────────────────────────────────────────────
// Get a file id first
const fileRes = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    job: { $: { id: JOB_ID }, files: { nodes: { id: {}, name: {} } } }
  }}),
});
const fileId = fileRes.parsed?.job?.files?.nodes?.[0]?.id;
console.log('First file id:', fileId);

if (fileId) {
  // Probe all file fields
  const fileScalars = ['id', 'name', 'url', 'type', 'size', 'mimeType', 'contentType',
    'extension', 'filename', 'path', 'createdAt', 'updatedAt', 'description'];
  console.log('── file scalar fields ──');
  for (const f of fileScalars) {
    const { text, parsed, status } = await safeFetch(PAVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { $: { grantKey: KEY },
        file: { $: { id: fileId }, id: {}, [f]: {} }
      }}),
    });
    if (status === 200 && parsed?.file?.[f] !== undefined) {
      console.log(`✓ file.${f} = ${JSON.stringify(parsed.file[f])}`);
    } else if (status === 200 && !text.includes('does not exist')) {
      console.log(`? file.${f}: ${text.slice(0, 80)}`);
    } else {
      process.stdout.write(`✗ ${f}  `);
    }
  }
  console.log('\n---');
}

// ── 6. job.files with folder structure ───────────────────────────────────────
await probe('job.files with folder', {
  job: {
    $: { id: JOB_ID },
    files: {
      $: { size: 5 },
      nodes: {
        id: {}, name: {}, url: {}, type: {}, size: {}, createdAt: {},
        folder: { id: {}, name: {} },
      }
    }
  }
});

// ── 7. What does job.folders actually return (try as array)? ─────────────────
await probe('job.folders without subfields', {
  job: {
    $: { id: JOB_ID },
    id: {},
    name: {},
    folders: {},
  }
});
