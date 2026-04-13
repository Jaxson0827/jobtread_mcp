const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const FILE_ID = '22NysbGPxsX4';
const JOB_ID = '22NysTtLh6LA';

async function safeFetch(label, q) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (parsed && res.status === 200) {
    console.log(`✓ ${label}:\n`, JSON.stringify(parsed, null, 2).slice(0, 800));
  } else {
    console.log(`✗ ${label} [${res.status}]: ${text.slice(0, 300)}`);
  }
  console.log('---');
  return parsed;
}

// Clean up probe artifact — reset description to null
await safeFetch('cleanup: clear description', {
  updateFile: {
    $: { id: FILE_ID, description: null },
    file: { id: {}, name: {}, description: {} }
  }
});

// Confirm updateFile response shape
await safeFetch('updateFile response shape', {
  updateFile: {
    $: { id: FILE_ID, name: 'image.jpg' },
    updatedFile: { id: {}, name: {}, description: {} }
  }
});

// Try updateFile with 'file' key in response
await safeFetch('updateFile with file key', {
  updateFile: {
    $: { id: FILE_ID, name: 'image.jpg' },
    file: { id: {}, name: {}, description: {} }
  }
});

// Probe createFile parameters
console.log('════ createFile probe ════');
for (const [label, params] of [
  ['url + name + jobId', { url: 'https://example.com/test.pdf', name: 'test.pdf', jobId: JOB_ID }],
  ['url + name + job nested', { file: { url: 'https://example.com/test.pdf', name: 'test.pdf', jobId: JOB_ID }}],
  ['name only', { name: 'test.pdf' }],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      createFile: { $: params, createdFile: { id: {}, name: {} } }
    }}),
  });
  const text = await res.text();
  console.log(`createFile [${label}] [${res.status}]: ${text.slice(0, 300)}`);
}

// Probe job.files fields more carefully — no offset but maybe page/cursor?
for (const [label, params] of [
  ['size only', { size: 5 }],
  ['size + page', { size: 5, page: 1 }],
  ['size + after', { size: 5, after: null }],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      job: { $: { id: JOB_ID }, files: { $: params, nodes: { id: {}, name: {} }, totalCount: {} } }
    }}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200) {
    console.log(`✓ job.files [${label}]: totalCount=${parsed?.job?.files?.totalCount} nodes=${parsed?.job?.files?.nodes?.length}`);
  } else {
    console.log(`✗ job.files [${label}] [${res.status}]: ${text.slice(0, 150)}`);
  }
}

// Confirm deleteFile works
await safeFetch('deleteFile with fake valid-format ID', {
  deleteFile: { $: { id: '22NysTtLh6LA' } } // job ID, should fail gracefully
});
