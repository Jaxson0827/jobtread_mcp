const PAVE = 'https://api.jobtread.com/pave';
const KEY = process.env.JOBTREAD_GRANT_KEY;
const ORG = process.env.JOBTREAD_ORG_ID;
const JOB_ID = '22NysTtLh6LA';
const COMMENT_ID = '22Nysaq2VKNY';

async function probe(label, q) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY }, ...q } }),
  });
  const text = await res.text();
  try {
    console.log(`✓ ${label}:\n`, JSON.stringify(JSON.parse(text), null, 2).slice(0, 800));
  } catch {
    console.log(`✗ ${label}: ${text.slice(0, 300)}`);
  }
  console.log('---');
}

// ── 1. Try targetId + targetType (same pattern as tasks) ─────────────────────
await probe('createComment targetId+targetType job', {
  createComment: {
    $: { message: '__probe__', targetId: JOB_ID, targetType: 'job' },
    createdComment: { id: {}, message: {} }
  }
});

// ── 2. Try parentId / commentId for thread replies ────────────────────────────
for (const [param, val] of [
  ['parentId', COMMENT_ID],
  ['commentId', COMMENT_ID],
  ['parentCommentId', COMMENT_ID],
  ['replyToId', COMMENT_ID],
  ['threadId', COMMENT_ID],
]) {
  const res = await fetch(PAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: KEY },
      createComment: {
        $: { message: '__probe__', [param]: val },
        createdComment: { id: {} }
      }
    }}),
  });
  const text = await res.text();
  if (text.includes('no value is ever expected')) {
    console.log(`✗ createComment.${param} — invalid field`);
  } else {
    let parsed; try { parsed = JSON.parse(text); } catch {}
    const id = parsed?.createComment?.createdComment?.id;
    if (id) {
      console.log(`✓ createComment.${param} works — created ${id}`);
      await fetch(PAVE, { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ query: {$:{grantKey:KEY}, deleteComment:{$:{id}}}}) });
    } else {
      console.log(`~ createComment.${param}: ${text.slice(0, 200)}`);
    }
  }
}

console.log('---');
// ── 3. Restore the comment we modified with updateComment ─────────────────────
await probe('restore comment 22Nysaq2VKNY', {
  updateComment: {
    $: { id: COMMENT_ID, message: 'This is a test message' },
    comment: { $: { id: COMMENT_ID }, id: {}, message: {} }
  }
});
