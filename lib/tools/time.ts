import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getTimeEntries,
  createTimeEntry,
  getDailyLogs,
  createDailyLog,
  formatMinutes,
} from '../jobtread/time.js';
import { getJobCostItems } from '../jobtread/budgets.js';
import { ok, err } from './_helpers.js';

/**
 * Build ISO timestamps from a YYYY-MM-DD date and a duration in hours.
 * Start time is anchored at 08:00 UTC on the given date.
 */
function buildTimeRange(date: string, hours: number): { startedAt: string; endedAt: string } {
  const startMs = new Date(`${date}T08:00:00.000Z`).getTime();
  const endMs = startMs + Math.round(hours * 60 * 60 * 1000);
  return {
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(endMs).toISOString(),
  };
}

export function registerTimeTools(server: McpServer): void {
  server.registerTool(
    'log_time',
    {
      description:
        'Log hours worked on a job. Accepts hours (e.g. 4.5) and a date; converts to minutes internally. ' +
        'A cost item from the job is required by the API — the first available cost item is used automatically. ' +
        'If the job has no cost items, call add_budget_item first to add at least one line item.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        hours: z
          .number()
          .positive()
          .describe('Number of hours worked (e.g. 4 or 4.5)'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('Work date in YYYY-MM-DD format'),
        notes: z
          .string()
          .optional()
          .describe('Description of the work performed'),
        user_id: z
          .string()
          .optional()
          .describe(
            'Ignored — time entries are created under the grant key owner. Provided for spec compatibility.'
          ),
      },
    },
    async ({ job_id, hours, date, notes }) => {
      try {
        // Resolve a costItemId — required by the JobTread API
        const costItems = await getJobCostItems(job_id);
        if (costItems.length === 0) {
          return err(
            `Job ${job_id} has no cost items. Use add_budget_item to add at least one line item before logging time.`
          );
        }
        const costItemId = costItems[0].id!;

        const { startedAt, endedAt } = buildTimeRange(date, hours);
        const entry = await createTimeEntry({ jobId: job_id, costItemId, startedAt, endedAt, notes });

        const minutes = Math.round(hours * 60);
        return ok({
          id: entry.id,
          job_id,
          hours,
          minutes,
          formatted: formatMinutes(minutes),
          date,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          notes: entry.notes ?? null,
          costItemUsed: costItems[0].name,
          createdAt: entry.createdAt,
        });
      } catch (e) {
        return err(`Failed to log time: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'get_time_entries',
    {
      description:
        'Retrieve time entries for a job, showing start/end times, duration in minutes, and the worker. Returns a total minutes and formatted total at the end.',
      inputSchema: {
        job_id: z
          .string()
          .describe('The JobTread job ID — required (the API only supports querying by job)'),
      },
    },
    async ({ job_id }) => {
      try {
        const entries = await getTimeEntries(job_id);
        const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);

        return ok({
          job_id,
          total: entries.length,
          totalMinutes,
          totalHours: +(totalMinutes / 60).toFixed(2),
          totalFormatted: formatMinutes(totalMinutes),
          entries: entries.map((e) => ({
            id: e.id,
            startedAt: e.startedAt,
            endedAt: e.endedAt,
            minutes: e.minutes,
            hours: e.minutes != null ? +(e.minutes / 60).toFixed(2) : null,
            formatted: e.minutes != null ? formatMinutes(e.minutes) : null,
            notes: e.notes ?? null,
            worker: e.user?.name ?? null,
            createdAt: e.createdAt,
          })),
        });
      } catch (e) {
        return err(`Failed to get time entries: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'create_daily_log',
    {
      description:
        'Create a daily log entry (project diary / field note) for a job. Use this to record what happened on a given day — work performed, issues encountered, weather, deliveries, etc. This is separate from time entries.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('Log date in YYYY-MM-DD format'),
        notes: z
          .string()
          .min(1)
          .describe('Log entry text — work performed, observations, issues, weather, etc.'),
        user_id: z
          .string()
          .optional()
          .describe(
            'Ignored — log is created under the grant key owner. Provided for spec compatibility.'
          ),
      },
    },
    async ({ job_id, date, notes }) => {
      try {
        const log = await createDailyLog({ jobId: job_id, date, notes });
        return ok({
          id: log.id,
          job_id,
          date: log.date,
          notes: log.notes,
          createdAt: log.createdAt,
        });
      } catch (e) {
        return err(`Failed to create daily log: ${(e as Error).message}`);
      }
    }
  );

  // Also expose existing daily logs retrieval as a bonus tool
  server.registerTool(
    'get_daily_logs',
    {
      description:
        'Retrieve all daily log entries for a job, ordered by date. Shows who created each entry and the notes recorded.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const logs = await getDailyLogs(job_id);
        return ok({
          job_id,
          total: logs.length,
          logs: logs.map((l) => ({
            id: l.id,
            date: l.date,
            notes: l.notes,
            createdBy: l.user?.name ?? null,
            createdAt: l.createdAt,
          })),
        });
      } catch (e) {
        return err(`Failed to get daily logs: ${(e as Error).message}`);
      }
    }
  );
}
