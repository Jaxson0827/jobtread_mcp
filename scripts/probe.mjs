const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const NEW_LOC_ID = '22PVGrCE7pZD';

async function probe(label, q) {
  const res = await fetch(PAVE, { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }) });
  const text = await res.text();
  try { console.log(`✓ ${label}:`, JSON.stringify(JSON.parse(text)).slice(0, 600)); }
  catch { console.log(`✗ ${label}: ${text.slice(0, 500)}`); }
}

// Create job with the existing test location
const jobRes = await fetch(PAVE, { method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ query: { $: { grantKey: KEY }, createJob: {
    $: { name: 'MCP Doc Test Job', locationId: NEW_LOC_ID },
    createdJob: { id: {}, name: {} }
  }}})
});
const jobData = await jobRes.json();
const newJobId = jobData?.createJob?.createdJob?.id;
console.log('New job ID:', newJobId);

if (newJobId) {
  // Try createDocument on new job
  await probe('createDocument on new job', { createDocument: {
    $: { name: 'Test Estimate MCP', jobId: newJobId, type: 'customerOrder',
      fromName: 'Yeti Welding', toName: "Test Customer", taxRate: 0 },
    createdDocument: { id: {}, name: {}, number: {}, type: {}, status: {} }
  }});
  
  // Cleanup
  await probe('cleanup: deleteJob', { deleteJob: { $: { id: newJobId } } });
}
await probe('cleanup: deleteLocation', { deleteLocation: { $: { id: NEW_LOC_ID } } });
