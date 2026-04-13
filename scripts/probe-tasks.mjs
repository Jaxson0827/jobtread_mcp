const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const JOB_ID = '22NysTtLh6LA';
const TEST_TASK_ID = '22PVVMusXENM'; // created during probe - needs cleanup

async function probe(label, q) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  const text = await res.text();
  try {
    console.log(`✓ ${label}:\n`, JSON.stringify(JSON.parse(text), null, 2).slice(0, 1200));
  } catch {
    console.log(`✗ ${label}: ${text.slice(0, 300)}`);
  }
  console.log('---');
}

// ── 1. Delete the probe task from last run ────────────────────────────────────
await probe('delete probe task', {
  deleteTask: { $: { id: TEST_TASK_ID } }
});

// ── 2. createTask with all possible optional params ───────────────────────────
// First create a task to confirm full param set
await probe('createTask with all known optional params', {
  createTask: {
    $: {
      name: 'Probe Full Task',
      targetId: JOB_ID,
      targetType: 'job',
      description: 'Test description',
      startDate: '2025-06-01',
      endDate: '2025-06-30',
      progress: 0,
    },
    createdTask: { id: {}, name: {}, description: {}, progress: {}, startDate: {}, endDate: {}, createdAt: {} }
  }
});

// ── 3. Try optional createTask params one at a time ───────────────────────────
for (const [param, val] of [
  ['userId', '22NysRKg27AW'],  // Matt Warren
  ['assigneeId', '22NysRKg27AW'],
  ['assignee', '22NysRKg27AW'],
  ['priority', 'high'],
  ['order', 1],
  ['completed', 0],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      createTask: {
        $: { name: '__probe__', targetId: JOB_ID, targetType: 'job', [param]: val },
        createdTask: { id: {}, name: {} }
      }
    }}),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const createdId = parsed?.createTask?.createdTask?.id;
  if (createdId) {
    console.log(`✓ createTask.${param} accepted — id: ${createdId}`);
    // clean up
    await fetch(PAVE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { $: { grantKey: KEY }, deleteTask: { $: { id: createdId } } } }) });
  } else if (text.includes('no value is ever expected')) {
    console.log(`✗ createTask.${param} — not a valid field`);
  } else {
    console.log(`~ createTask.${param}: ${text.slice(0, 200)}`);
  }
}
