import { paveQuery } from './client.js';
import type { Job, JobFile } from '../types.js';

const JOB_FIELDS = {
  id: {},
  name: {},
  number: {},
  status: {},
  description: {},
  createdAt: {},
  location: {
    id: {},
    name: {},
    address: {},
    formattedAddress: {},
    city: {},
    state: {},
    postalCode: {},
    country: {},
  },
};

// The Pave API accepts `size` (max 100) but has no cursor/offset pagination.
// We fetch the maximum in one call. Accounts with >100 jobs will be truncated
// at the API level — this is the best available without a server-side workaround.
const JOBS_PAGE_SIZE = 100;

export async function searchJobs(query?: string): Promise<Partial<Job>[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      jobs: {
        $: { size: JOBS_PAGE_SIZE },
        nodes: JOB_FIELDS,
      },
    },
  });

  const jobs: Partial<Job>[] = data?.organization?.jobs?.nodes ?? [];

  if (!query) return jobs;

  const lower = query.toLowerCase();
  return jobs.filter(
    (j) =>
      j.name?.toLowerCase().includes(lower) ||
      j.number?.toLowerCase().includes(lower) ||
      j.description?.toLowerCase().includes(lower) ||
      j.status?.toLowerCase().includes(lower)
  );
}

export async function getJob(id: string): Promise<Partial<Job>> {
  const data = await paveQuery({
    job: {
      $: { id },
      ...JOB_FIELDS,
    },
  });
  return data?.job ?? {};
}

export interface CreateJobInput {
  name: string;
  locationId: string;
  description?: string;
  number?: string;
}

export async function createJob(input: CreateJobInput): Promise<Partial<Job>> {
  const params: Record<string, unknown> = {
    name: input.name,
    locationId: input.locationId,
  };
  if (input.description) params['description'] = input.description;
  if (input.number) params['number'] = input.number;

  const data = await paveQuery({
    createJob: {
      $: params,
      createdJob: {
        id: {},
        name: {},
        number: {},
        status: {},
      },
    },
  });
  return data?.createJob?.createdJob ?? {};
}

export interface UpdateJobInput {
  id: string;
  name?: string;
  description?: string;
}

export async function updateJob(input: UpdateJobInput): Promise<Partial<Job>> {
  const params: Record<string, unknown> = { id: input.id };
  if (input.name !== undefined) params['name'] = input.name;
  if (input.description !== undefined) params['description'] = input.description;

  const data = await paveQuery({
    updateJob: {
      $: params,
      job: {
        $: { id: input.id },
        id: {},
        name: {},
        number: {},
        status: {},
        description: {},
      },
    },
  });
  return data?.updateJob?.job ?? {};
}

export async function getJobsByStatus(status: string): Promise<Partial<Job>[]> {
  const all = await searchJobs();
  return all.filter((j) => j.status === status);
}

/**
 * Return all active jobs — those with status 'created' or 'approved'.
 * Sorted newest createdAt first as a convenience for Claude.
 */
export async function getActiveJobs(): Promise<Partial<Job>[]> {
  const all = await searchJobs();
  return all
    .filter((j) => j.status === 'created' || j.status === 'approved')
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
}

/**
 * Return files attached to a job (images, PDFs, etc.).
 *
 * NOTE: `job.folders` exists in the Pave API but always returns an empty scalar
 * array with no queryable sub-fields — there is no folder structure accessible
 * via the API. Files are returned directly via `job.files`.
 */
export async function getJobFiles(jobId: string): Promise<Partial<JobFile>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      files: {
        $: { size: 100 },
        nodes: {
          id: {},
          name: {},
          url: {},
          type: {},
          size: {},
          description: {},
          createdAt: {},
        },
      },
    },
  });
  return data?.job?.files?.nodes ?? [];
}
