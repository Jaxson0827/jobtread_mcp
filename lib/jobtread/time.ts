import { paveQuery } from './client.js';
import type { TimeEntry, DailyLog } from '../types.js';

const TIME_ENTRY_FIELDS = {
  id: {},
  minutes: {},
  notes: {},
  startedAt: {},
  endedAt: {},
  createdAt: {},
  user: { id: {}, name: {} },
};

const DAILY_LOG_FIELDS = {
  id: {},
  date: {},
  notes: {},
  createdAt: {},
  user: { id: {}, name: {} },
};

export async function getTimeEntries(jobId: string): Promise<Partial<TimeEntry>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      timeEntries: {
        nodes: TIME_ENTRY_FIELDS,
      },
    },
  });
  return data?.job?.timeEntries?.nodes ?? [];
}

export interface CreateTimeEntryInput {
  jobId: string;
  costItemId: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
}

/**
 * Log a time entry on a job against a specific cost item.
 * startedAt and endedAt should be ISO 8601 datetime strings (e.g. "2026-04-09T09:00:00Z").
 * The API calculates minutes automatically from start/end times.
 */
export async function createTimeEntry(input: CreateTimeEntryInput): Promise<Partial<TimeEntry>> {
  const params: Record<string, unknown> = {
    type: 'standard',
    jobId: input.jobId,
    costItemId: input.costItemId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
  if (input.notes) params['notes'] = input.notes;

  const data = await paveQuery({
    createTimeEntry: {
      $: params,
      createdTimeEntry: {
        id: {},
        minutes: {},
        startedAt: {},
        endedAt: {},
        notes: {},
        createdAt: {},
      },
    },
  });
  return data?.createTimeEntry?.createdTimeEntry ?? {};
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await paveQuery({ deleteTimeEntry: { $: { id } } });
}

export async function getDailyLogs(jobId: string): Promise<Partial<DailyLog>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      dailyLogs: {
        nodes: DAILY_LOG_FIELDS,
      },
    },
  });
  return data?.job?.dailyLogs?.nodes ?? [];
}

export interface CreateDailyLogInput {
  jobId: string;
  date: string;
  notes?: string;
}

/**
 * Create a daily log entry on a job.
 * date should be in YYYY-MM-DD format.
 */
export async function createDailyLog(input: CreateDailyLogInput): Promise<Partial<DailyLog>> {
  const params: Record<string, unknown> = {
    date: input.date,
    jobId: input.jobId,
  };
  if (input.notes) params['notes'] = input.notes;

  const data = await paveQuery({
    createDailyLog: {
      $: params,
      createdDailyLog: {
        id: {},
        date: {},
        notes: {},
        createdAt: {},
      },
    },
  });
  return data?.createDailyLog?.createdDailyLog ?? {};
}

export async function deleteDailyLog(id: string): Promise<void> {
  await paveQuery({ deleteDailyLog: { $: { id } } });
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Fetch a single time entry by its ID.
 * Returns the entry with user and job relations.
 */
export async function getTimeEntryById(
  timeEntryId: string
): Promise<Partial<TimeEntry> & { job?: { id: string; name: string } | null }> {
  const data = await paveQuery({
    timeEntry: {
      $: { id: timeEntryId },
      ...TIME_ENTRY_FIELDS,
      job: { id: {}, name: {} },
    },
  });
  return data?.timeEntry ?? {};
}

export interface OrgTimeEntry extends Partial<TimeEntry> {
  job?: { id: string; name: string } | null;
}

/**
 * Fetch all time entries across the entire organization (up to 500).
 * NOTE: org.timeEntries does not accept filter params (jobId, userId, dates) —
 * all filtering must happen client-side.
 */
export async function getOrgTimeEntries(): Promise<OrgTimeEntry[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      timeEntries: {
        $: { size: 100 },
        nodes: {
          ...TIME_ENTRY_FIELDS,
          job: { id: {}, name: {} },
        },
      },
    },
  });
  return data?.organization?.timeEntries?.nodes ?? [];
}
