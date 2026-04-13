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
    console.log(`✓ ${label}:\n`, JSON.stringify(parsed, null, 2).slice(0, 600));
  } else {
    console.log(`✗ ${label} [${res.status}]: ${text.slice(0, 300)}`);
  }
  console.log('---');
  return parsed;
}

// updateFile: The mutation seems to require a nested "file" selector with its own $params
// The pattern is: updateFile: { file: { $: { id }, updateField: value }, resultField: {} }
// OR it could be: updateFile: { $: { id }, updateFile: { ... } }

// Try the pattern where the file sub-object takes the ID + updated fields
await safeFetch('updateFile nested-file pattern', {
  updateFile: {
    file: {
      $: { id: FILE_ID, name: 'image.jpg', description: '' },
      id: {}, name: {}, description: {}
    }
  }
});

// Another pattern: top-level params
await safeFetch('updateFile direct params', {
  updateFile: {
    $: { id: FILE_ID },
    updateFile: { id: {}, name: {} }
  }
});

// Maybe updateFile = the file node selector? 
await safeFetch('updateFile is the selector', {
  updateFile: {
    $: { id: FILE_ID, name: 'image.jpg' },
    updateFile: { id: {}, name: {} }
  }
});

// probe: is it "file" with a mutation sub-key?
await safeFetch('file mutation update', {
  file: {
    $: { id: FILE_ID },
    update: { $: { name: 'image.jpg' }, id: {}, name: {} }
  }
});

// Try createFile with targetId
await safeFetch('createFile with targetId', {
  createFile: {
    $: { targetId: JOB_ID, name: 'probe_test.txt', url: 'https://example.com/probe.txt' },
    createdFile: { id: {}, name: {} }
  }
});

await safeFetch('createFile with targetId and targetType', {
  createFile: {
    $: { targetId: JOB_ID, targetType: 'job', name: 'probe_test.txt', url: 'https://example.com/probe.txt' },
    createdFile: { id: {}, name: {} }
  }
});

// Maybe createFile needs a "file" nested object
await safeFetch('createFile with nested file object', {
  createFile: {
    $: { targetId: JOB_ID, file: { name: 'probe_test.txt', url: 'https://example.com/probe.txt' } },
    createdFile: { id: {}, name: {} }
  }
});

// job.files without totalCount
await safeFetch('job.files nodes only', {
  job: {
    $: { id: JOB_ID },
    files: {
      $: { size: 5 },
      nodes: { id: {}, name: {}, url: {}, type: {}, size: {}, description: {}, createdAt: {} }
    }
  }
});
