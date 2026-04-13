/**
 * Live integration test for all 4 task tools.
 * Run: npx tsx scripts/test-tasks.ts
 */

import { getJobTasks, getTask, createTask, updateTask, deleteTask } from '../lib/jobtread/tasks.js';

let passed = 0;
let failed = 0;
const createdIds: string[] = [];

function assert(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`, detail ?? '');
    failed++;
  }
}

const JOB_ID = '22NysTtLh6LA'; // Mapleton Parks and Rec

// ── get_tasks ────────────────────────────────────────────────────────────────
console.log('\n── get_tasks ──');
const tasks = await getJobTasks(JOB_ID);
console.log(`  Returned ${tasks.length} tasks`);
assert('returns array', Array.isArray(tasks));
assert('has tasks', tasks.length > 0);
assert('each task has id', tasks.every((t) => typeof t.id === 'string'));
assert('each task has name', tasks.every((t) => typeof t.name === 'string'));
assert('progress is 0-1 or null', tasks.every((t) => t.progress == null || (t.progress >= 0 && t.progress <= 1)));
assert('completed is 0 or 1', tasks.every((t) => t.completed === 0 || t.completed === 1));
console.log(`  Sample: "${tasks[0].name}" | progress: ${tasks[0].progress} | completed: ${tasks[0].completed} | endDate: ${tasks[0].endDate}`);

// ── get_task_details ─────────────────────────────────────────────────────────
console.log('\n── get_task_details ──');
const taskId = tasks[0].id!;
const detail = await getTask(taskId);
assert('task has id', !!detail.id);
assert('task has name', !!detail.name);
assert('task has job relation', !!detail.job?.id);
console.log(`  Task: "${detail.name}" | job: "${detail.job?.name}" | desc: ${detail.description?.slice(0, 50)}`);

// ── create_task ───────────────────────────────────────────────────────────────
console.log('\n── create_task ──');
const created = await createTask({
  jobId: JOB_ID,
  name: '[TEST] MCP Integration Test Task',
  description: 'Created by test-tasks.ts — will be deleted',
  dueDate: '2025-12-31',
});
assert('task created with id', !!created.id);
assert('task has correct name', created.name === '[TEST] MCP Integration Test Task');
assert('task has description', created.description === 'Created by test-tasks.ts — will be deleted');
assert('task has endDate', created.endDate === '2025-12-31');
assert('task starts at 0 progress', created.progress === 0 || created.progress === null);
assert('task starts incomplete', created.completed === 0);
console.log(`  Created task ID: ${created.id}`);
if (created.id) createdIds.push(created.id);

// ── update_task_progress ──────────────────────────────────────────────────────
if (created.id) {
  console.log('\n── update_task_progress (50%) ──');
  const updated50 = await updateTask({ id: created.id, progress: 0.5 });
  assert('progress updated to 0.5', updated50.progress === 0.5);
  assert('not yet completed', updated50.completed === 0);
  console.log(`  progress=${updated50.progress}, completed=${updated50.completed}`);

  console.log('\n── update_task_progress (100%) ──');
  const updated100 = await updateTask({ id: created.id, progress: 1.0 });
  assert('progress updated to 1.0', updated100.progress === 1);
  assert('auto-marked completed', updated100.completed === 1);
  console.log(`  progress=${updated100.progress}, completed=${updated100.completed}`);

  console.log('\n── update_task description (notes) ──');
  const withNotes = await updateTask({ id: created.id, description: 'Updated notes via MCP' });
  assert('description updated', withNotes.description === 'Updated notes via MCP');
}

// ── cleanup ───────────────────────────────────────────────────────────────────
console.log('\n── cleanup ──');
for (const id of createdIds) {
  try {
    await deleteTask(id);
    console.log(`  ✓ deleted ${id}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ failed to delete ${id}:`, (e as Error).message);
    failed++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
