/**
 * Integration test for comment tools.
 * Run with: npx tsx scripts/test-comments.ts
 */
import { getJobComments, getComment, createComment } from '../lib/jobtread/comments.js';

const TEST_JOB_ID = '22NysTtLh6LA'; // Mapleton Parks and Rec
let passed = 0;
let failed = 0;

function assert(label: string, value: unknown, check: (v: unknown) => boolean) {
  if (check(value)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(value)}`);
    failed++;
  }
}

console.log('\n── getJobComments ──');
const comments = await getJobComments(TEST_JOB_ID);
assert('returns array', comments, (v) => Array.isArray(v));
assert('at least 1 comment', comments, (v) => (v as unknown[]).length > 0);

const first = comments[0];
assert('comment has id', first?.id, (v) => typeof v === 'string' && (v as string).length > 0);
assert('comment has message', first?.message, (v) => typeof v === 'string' && (v as string).length > 0);
assert('comment has createdAt', first?.createdAt, (v) => typeof v === 'string');
// account may be null for some comments, just check it's defined as a key
assert('comment has account key', 'account' in first, (v) => v === true);
// Newest-first: last comment in original order should be first
assert('ordered newest first', comments, (v) => {
  const arr = v as typeof comments;
  if (arr.length < 2) return true;
  return new Date(arr[0].createdAt!).getTime() >= new Date(arr[arr.length - 1].createdAt!).getTime();
});

const firstCommentId = first.id!;
console.log(`  Sample comment id: ${firstCommentId}`);
console.log(`  Sample message: ${String(first.message).slice(0, 60)}`);

console.log('\n── getComment by ID ──');
const detail = await getComment(firstCommentId);
assert('detail has id', detail.id, (v) => v === firstCommentId);
assert('detail has message', detail.message, (v) => typeof v === 'string');
assert('detail has createdAt', detail.createdAt, (v) => typeof v === 'string');
assert('detail has job relation', detail.job?.id, (v) => typeof v === 'string');

console.log('\n── createComment ──');
const newComment = await createComment({
  jobId: TEST_JOB_ID,
  message: `[MCP test] Comment created by test-comments.ts at ${new Date().toISOString()}`,
  subject: 'MCP Integration Test',
});
assert('created comment has id', newComment.id, (v) => typeof v === 'string' && (v as string).length > 0);
assert('created comment message matches', newComment.message, (v) =>
  typeof v === 'string' && (v as string).includes('[MCP test]')
);
assert('created comment has job', newComment.job?.id, (v) => v === TEST_JOB_ID);

const createdId = newComment.id!;
console.log(`  Created comment id: ${createdId}`);

console.log('\n── verify new comment appears in list ──');
const refreshed = await getJobComments(TEST_JOB_ID);
assert('new comment appears newest first', refreshed[0]?.id, (v) => v === createdId);

console.log('\n────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
