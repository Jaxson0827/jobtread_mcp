import { paveQuery } from './client.js';
import type { Task } from '../types.js';

/**
 * Fields available on a task node.
 *
 * API notes (discovered via probing):
 * - `progress` is stored as 0.0–1.0 (NOT 0–100)
 * - `completed` is 0/1, auto-set by the API when progress reaches 1.0
 * - `endDate` is the due date (no `dueDate` field exists)
 * - There is NO assignee/user field on tasks in the Pave API
 */
const TASK_FIELDS = {
  id: {},
  name: {},
  description: {},
  progress: {},
  completed: {},
  startDate: {},
  endDate: {},
  createdAt: {},
};

export async function getJobTasks(jobId: string): Promise<Partial<Task>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      tasks: {
        $: { size: 100 },
        nodes: TASK_FIELDS,
      },
    },
  });
  return data?.job?.tasks?.nodes ?? [];
}

export async function getTask(taskId: string): Promise<Partial<Task>> {
  const data = await paveQuery({
    task: {
      $: { id: taskId },
      ...TASK_FIELDS,
      job: { id: {}, name: {} },
    },
  });
  return data?.task ?? {};
}

export interface CreateTaskInput {
  jobId: string;
  name: string;
  description?: string;
  /** Due date in YYYY-MM-DD format — stored as endDate in the API */
  dueDate?: string;
  /** Start date in YYYY-MM-DD format */
  startDate?: string;
  /** Initial progress 0.0–1.0 */
  progress?: number;
}

export async function createTask(input: CreateTaskInput): Promise<Partial<Task>> {
  const params: Record<string, unknown> = {
    name: input.name,
    targetId: input.jobId,
    targetType: 'job',
  };
  if (input.description) params['description'] = input.description;
  if (input.progress !== undefined) params['progress'] = input.progress;

  // The API requires BOTH startDate and endDate if either is supplied.
  // Default startDate to the due date when only a due date is provided.
  if (input.dueDate || input.startDate) {
    params['endDate'] = input.dueDate ?? input.startDate;
    params['startDate'] = input.startDate ?? input.dueDate;
  }

  const data = await paveQuery({
    createTask: {
      $: params,
      createdTask: TASK_FIELDS,
    },
  });
  return data?.createTask?.createdTask ?? {};
}

export interface UpdateTaskInput {
  id: string;
  name?: string;
  description?: string;
  /** Due date update — maps to endDate */
  dueDate?: string;
  /** Progress 0.0–1.0. Setting to 1.0 auto-marks the task completed. */
  progress?: number;
}

export async function updateTask(input: UpdateTaskInput): Promise<Partial<Task>> {
  const params: Record<string, unknown> = { id: input.id };
  if (input.name !== undefined) params['name'] = input.name;
  if (input.description !== undefined) params['description'] = input.description;
  if (input.dueDate !== undefined) params['endDate'] = input.dueDate;
  if (input.progress !== undefined) params['progress'] = input.progress;

  const data = await paveQuery({
    updateTask: {
      $: params,
      task: {
        $: { id: input.id },
        ...TASK_FIELDS,
      },
    },
  });
  return data?.updateTask?.task ?? {};
}

export async function deleteTask(id: string): Promise<void> {
  await paveQuery({ deleteTask: { $: { id } } });
}
