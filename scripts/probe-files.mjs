const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const JOB_ID = '22NysTtLh6LA'; // Mapleton Parks and Rec
// Known file IDs from prior probing: 22NysbGPxsX4 (image.jpg), 22NysbMg7JMw (Photo 1)
const FILE_ID = '22NysbGPxsX4';

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

// ── 1. Confirm all file scalar fields ─────────────────────────────────────────
console.log('════ FILE SCALAR FIELDS ════');
const fileScalars = [
  'id', 'name', 'url', 'type', 'size', 'description', 'createdAt',
  'updatedAt', 'mimeType', 'contentType', 'extension', 'filename',
  'path', 'key', 'bucket', 'hash', 'checksum', 'width', 'height',
  'thumbnail', 'thumbnailUrl', 'previewUrl', 'public', 'private',
  'status', 'visibility', 'label', 'tags', 'metadata',
];
for (const f of fileScalars) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      file: { $: { id: FILE_ID }, id: {}, [f]: {} }
    }}),
  });
  if (status === 200 && parsed?.file?.[f] !== undefined) {
    console.log(`✓ file.${f} = ${JSON.stringify(parsed.file[f])?.slice(0, 80)}`);
  } else if (status === 200 && !text.includes('does not exist') && !text.includes('invalid')) {
    console.log(`? file.${f}: ${text.slice(0, 80)}`);
  } else {
    process.stdout.write(`✗ ${f}  `);
  }
}
console.log('\n---');

// ── 2. File relation fields ────────────────────────────────────────────────────
console.log('════ FILE RELATION FIELDS ════');
for (const f of ['job', 'account', 'user', 'createdBy', 'organization', 'contact', 'folder']) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      file: { $: { id: FILE_ID }, id: {}, [f]: { id: {}, name: {} } }
    }}),
  });
  if (status === 200 && !text.includes('does not exist')) {
    console.log(`✓ file.${f} = ${JSON.stringify(parsed?.file?.[f])}`);
  } else {
    process.stdout.write(`✗ ${f}  `);
  }
}
console.log('\n---');

// ── 3. updateFile mutation ────────────────────────────────────────────────────
console.log('════ updateFile MUTATION ════');
// Probe with invalid field to see what params are accepted
for (const [label, params] of [
  ['id only', { id: FILE_ID }],
  ['name update', { id: FILE_ID, name: 'image_probe.jpg' }],
  ['description update', { id: FILE_ID, description: '__probe__' }],
  ['name+description', { id: FILE_ID, name: 'image.jpg', description: '__probe__' }],
]) {
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      updateFile: {
        $: params,
        file: { $: { id: FILE_ID }, id: {}, name: {}, description: {} }
      }
    }}),
  });
  const updated = parsed?.updateFile?.file;
  if (updated?.id) {
    console.log(`✓ updateFile [${label}]: name="${updated.name}", desc="${updated.description}"`);
  } else {
    console.log(`~ updateFile [${label}] [${status}]: ${text.slice(0, 200)}`);
  }
}
console.log('---');

// ── 4. copyFile mutation ──────────────────────────────────────────────────────
console.log('════ copyFile MUTATION ════');
// Get a second job ID to test with
const jobsRes = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    organization: { $: { id: ORG }, jobs: { $: { size: 3 }, nodes: { id: {}, name: {} } } }
  }}),
});
const jobs = jobsRes.parsed?.organization?.jobs?.nodes ?? [];
const DEST_JOB_ID = jobs.find(j => j.id !== JOB_ID)?.id;
console.log('Destination job for copy test:', DEST_JOB_ID);

for (const [label, params] of [
  ['copyFile name', { fileId: FILE_ID, jobId: DEST_JOB_ID }],
  ['copyFile alt', { id: FILE_ID, targetJobId: DEST_JOB_ID }],
  ['copyFile alt2', { id: FILE_ID, jobId: DEST_JOB_ID }],
  ['duplicateFile', null], // will try differently below
]) {
  if (params === null) continue;
  const { text, parsed, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      copyFile: {
        $: params,
        copiedFile: { id: {}, name: {} }
      }
    }}),
  });
  const copied = parsed?.copyFile?.copiedFile;
  if (copied?.id) {
    console.log(`✓ copyFile [${label}]: created id ${copied.id}`);
    // Try to delete it
    const del = await safeFetch(PAVE, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query:{$:{grantKey:KEY},deleteFile:{$:{id:copied.id}}}}) });
    console.log('  deleted:', del.text.slice(0,80));
  } else {
    console.log(`~ copyFile [${label}] [${status}]: ${text.slice(0, 200)}`);
  }
}

// Also try other mutation names
for (const mutName of ['duplicateFile', 'cloneFile', 'moveFile', 'attachFile', 'createFile', 'addFile']) {
  const { text, status } = await safeFetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      [mutName]: { $: { id: FILE_ID }, file: { id: {} } }
    }}),
  });
  if (!text.includes('does not exist') && !text.includes('invalid')) {
    console.log(`? ${mutName} [${status}]: ${text.slice(0, 150)}`);
  } else {
    process.stdout.write(`✗ ${mutName}  `);
  }
}
console.log('\n---');

// ── 5. deleteFile mutation ────────────────────────────────────────────────────
console.log('════ deleteFile MUTATION ════');
const { text: delText, status: delStatus } = await safeFetch(PAVE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: { $: { grantKey: KEY },
    deleteFile: { $: { id: '00000fake' } }
  }}),
});
console.log(`deleteFile probe [${delStatus}]: ${delText.slice(0, 150)}`);

// ── 6. Full file query with all confirmed fields ───────────────────────────────
console.log('---');
await probe('file full confirmed fields', {
  file: {
    $: { id: FILE_ID },
    id: {}, name: {}, url: {}, type: {}, size: {}, description: {}, createdAt: {},
    job: { id: {}, name: {} },
  }
});

// ── 7. job.files with all fields + pagination ─────────────────────────────────
await probe('job.files pagination with size+offset', {
  job: {
    $: { id: JOB_ID },
    files: {
      $: { size: 5, offset: 0 },
      nodes: { id: {}, name: {}, url: {}, type: {}, size: {}, description: {}, createdAt: {} }
    }
  }
});

// ── 8. org-level files ────────────────────────────────────────────────────────
await probe('org.files', {
  organization: {
    $: { id: ORG },
    files: { $: { size: 3 }, nodes: { id: {}, name: {}, type: {} } }
  }
});
