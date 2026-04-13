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

// updateFile seems to have a "pdf" sub-field on its updateFile response...
// Maybe "updateFile.updateFile" means nested update — let me try "updateFile.updateFile.pdf"
await safeFetch('updateFile.updateFile.pdf', {
  updateFile: {
    $: { id: FILE_ID, name: 'image.jpg' },
    updateFile: { pdf: {} }
  }
});

// Maybe the response key is "file" for a file node, but "updateFile" has "updateFile" returning the file record
// Let's try to just not specify any sub-response and see the error
await safeFetch('updateFile no sub-fields', {
  updateFile: {
    $: { id: FILE_ID, name: 'image.jpg' },
  }
});

// Try calling updateFile where we think "updateFile" returns the sub-node called "file"
// Existing code from Phase 3 was: data?.updateFile?.createdComment -- so what if it's updateFile.updatedFile?
// Error said "did you mean updateFile" when we tried "updatedFile"
// So the only available sub-key is "updateFile" inside "updateFile"
// Let's check if the inner updateFile has file-like fields
for (const f of ['id', 'name', 'url', 'type', 'size', 'description', 'createdAt', 'file', 'pdf']) {
  const { text, parsed, status } = await safeFetch('', {}).then(() => ({text:'',parsed:null,status:0}));
  // Won't help, let me do them inline
}

// Direct field probes on updateFile's response node
for (const f of ['id', 'name', 'url', 'type', 'size', 'description', 'createdAt', 'pdf', 'file', 'job', 'account']) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      updateFile: {
        $: { id: FILE_ID, name: 'image.jpg' },
        updateFile: { [f]: f === 'job' || f === 'account' || f === 'file' ? { id: {} } : {} }
      }
    }}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200) {
    console.log(`✓ updateFile.updateFile.${f} = ${JSON.stringify(parsed?.updateFile?.updateFile?.[f])?.slice(0, 80)}`);
  } else if (!text.includes('does not exist') && !text.includes('no value is ever expected')) {
    console.log(`? updateFile.updateFile.${f} [${res.status}]: ${text.slice(0, 150)}`);
  } else {
    process.stdout.write(`✗ ${f}  `);
  }
}
console.log('\n---');

// createFile deeper probe: what params are accepted?
// We know: targetId (required), targetType (required), name (required), url NOT accepted
// Try: targetType = 'job', plus other content fields
for (const [label, params] of [
  ['targetId+targetType+name', { targetId: JOB_ID, targetType: 'job', name: 'probe.txt' }],
  ['targetId+targetType+name+description', { targetId: JOB_ID, targetType: 'job', name: 'probe.txt', description: 'test' }],
  ['targetId+targetType+name+size', { targetId: JOB_ID, targetType: 'job', name: 'probe.txt', size: 100 }],
  ['targetId+targetType+name+type', { targetId: JOB_ID, targetType: 'job', name: 'probe.txt', type: 'text/plain' }],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      createFile: { $: params, createdFile: { id: {}, name: {} } }
    }}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (res.status === 200 && parsed?.createFile?.createdFile?.id) {
    console.log(`✓ createFile [${label}]: id=${parsed.createFile.createdFile.id}`);
    // cleanup
    await fetch(PAVE, { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({query:{$:{grantKey:KEY},deleteFile:{$:{id:parsed.createFile.createdFile.id}}}}) });
  } else {
    console.log(`~ createFile [${label}] [${res.status}]: ${text.slice(0, 200)}`);
  }
}
