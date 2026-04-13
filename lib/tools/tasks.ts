import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getJobTasks, getTask, createTask, updateTask } from '../jobtread/tasks.js';
import { ok, err } from './_helpers.js';

/** Format a task's progress (0.0–1.0) as a percentage string for display */
function fmtProgress(progress: number | null | undefined): string {
  if (progress == null) return '0%';
  return `${Math.round(progress * 100)}%`;
}

/** Map raw task fields to the clean shape returned to Claude */
function formatTask(t: Partial<import('../types.js').Task>) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    progress: fmtProgress(t.progress),
    progressRaw: t.progress ?? 0,
    completed: t.completed === 1,
    dueDate: t.endDate ?? null,
    startDate: t.startDate ?? null,
    createdAt: t.createdAt,
  };
}

export function registerTaskTools(server: McpServer): void {
  // ── get_tasks ──────────────────────────────────────────────────────────────
  server.registerTool(
    'get_tasks',
    {
      description:
        'List all tasks attached to a job. Returns name, description, progress percentage, ' +
        'completion status, and due date for each task. Use this to see what work is outstanding on a job.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const tasks = await getJobTasks(job_id);
        const open = tasks.filter((t) => t.completed !== 1);
        const done = tasks.filter((t) => t.completed === 1);
        return ok({
          job_id,
          total: tasks.length,
          open: open.length,
          completed: done.length,
          tasks: tasks.map(formatTask),
        });
      } catch (e) {
        return err(`Failed to get tasks: ${(e as Error).message}`);
      }
    }
  );

  // ── get_task_details ───────────────────────────────────────────────────────
  server.registerTool(
    'get_task_details',
    {
      description:
        'Get full details for a single task by its ID. Returns all fields including description, ' +
        'progress, completion status, start date, and due date. Use get_tasks first to find the task ID.',
      inputSchema: {
        task_id: z.string().describe('The JobTread task ID'),
      },
    },
    async ({ task_id }) => {
      try {
        const task = await getTask(task_id);
        if (!task.id) return err(`Task not found: ${task_id}`);
        return ok({
          ...formatTask(task),
          job: task.job ? { id: task.job.id, name: task.job.name } : null,
        });
      } catch (e) {
        return err(`Failed to get task details: ${(e as Error).message}`);
      }
    }
  );

  // ── create_task ────────────────────────────────────────────────────────────
  server.registerTool(
    'create_task',
    {
      description:
        'Create a new task (to-do item) attached to a job. ' +
        'Tasks support a name, optional description, optional due date (endDate), and optional start date. ' +
        'IMPORTANT LIMITATION: The JobTread Pave API does not support setting an assignee on tasks — ' +
        'the assignee_user_id input is accepted for compatibility but cannot be stored via the API. ' +
        'Assignees must be set manually in the JobTread web interface.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID to attach this task to'),
        name: z.string().min(1).describe('Name or title of the task'),
        description: z.string().optional().describe('Optional longer description or notes'),
        due_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Due date in YYYY-MM-DD format'),
        assignee_user_id: z
          .string()
          .optional()
          .describe(
            'Accepted for compatibility but NOT stored — the JobTread API does not support task assignees. Use list_users to look up user IDs, then set assignees in the JobTread web interface.'
          ),
      },
    },
    async ({ job_id, name, description, due_date, assignee_user_id }) => {
      try {
        const task = await createTask({
          jobId: job_id,
          name,
          description,
          dueDate: due_date,
        });

        return ok({
          ...formatTask(task),
          note: assignee_user_id
            ? `Task created. NOTE: assignee_user_id "${assignee_user_id}" was not saved — the JobTread Pave API does not support setting task assignees programmatically. Please assign in the JobTread web interface.`
            : undefined,
        });
      } catch (e) {
        return err(`Failed to create task: ${(e as Error).message}`);
      }
    }
  );

  // ── update_task_progress ───────────────────────────────────────────────────
  server.registerTool(
    'update_task_progress',
    {
      description:
        'Update the progress on a task (0–100). Setting progress to 100 automatically marks the task as completed. ' +
        'Optionally update the task description at the same time. ' +
        'NOTE: The "notes" field is accepted as a convenience but is stored as the task description — ' +
        'the JobTread API does not have a separate notes field on tasks.',
      inputSchema: {
        task_id: z.string().describe('The JobTread task ID'),
        progress: z
          .number()
          .min(0)
          .max(100)
          .describe('Progress percentage 0–100. Setting to 100 marks the task complete.'),
        notes: z
          .string()
          .optional()
          .describe(
            'Optional notes — stored as the task description (the API has no separate notes field)'
          ),
      },
    },
    async ({ task_id, progress, notes }) => {
      try {
        // Convert 0-100 to 0.0-1.0 as required by the API
        const apiProgress = progress / 100;

        const task = await updateTask({
          id: task_id,
          progress: apiProgress,
          ...(notes !== undefined && { description: notes }),
        });

        return ok({
          ...formatTask(task),
          message:
            task.completed === 1
              ? 'Task marked as completed.'
              : `Progress updated to ${progress}%.`,
        });
      } catch (e) {
        return err(`Failed to update task progress: ${(e as Error).message}`);
      }
    }
  );
}
