import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchJobs, getJob, createJob, updateJob } from '../jobtread/jobs.js';
import { createLocation } from '../jobtread/accounts.js';
import { ok, err } from './_helpers.js';

export function registerJobTools(server: McpServer): void {
  server.registerTool(
    'search_jobs',
    {
      description:
        'Search and list jobs in JobTread. Filter by text (matches name, number, description) and/or status. Returns all jobs when no filters given. Use this to discover job IDs before calling get_job.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Text to search in job name, number, or description'),
        status: z
          .enum(['created', 'approved', 'closed', 'paid'])
          .optional()
          .describe('Filter by job status: created, approved, closed, or paid'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max results to return (default 20, max 100)'),
      },
    },
    async ({ query, status, limit = 20 }) => {
      try {
        let jobs = await searchJobs(query);
        if (status) jobs = jobs.filter((j) => j.status === status);
        jobs = jobs.slice(0, limit);
        return ok({
          total: jobs.length,
          jobs: jobs.map((j) => ({
            id: j.id,
            name: j.name,
            number: j.number,
            status: j.status,
            description: j.description ?? null,
            createdAt: j.createdAt,
            location: j.location?.formattedAddress ?? null,
          })),
        });
      } catch (e) {
        return err(`Failed to search jobs: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'get_job',
    {
      description:
        'Get complete details for a single job by its ID. Returns name, number, status, description, location, and creation date. Use search_jobs first to find the job ID.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const job = await getJob(job_id);
        if (!job.id) return err(`Job not found: ${job_id}`);
        return ok({
          id: job.id,
          name: job.name,
          number: job.number,
          status: job.status,
          description: job.description ?? null,
          createdAt: job.createdAt,
          location: job.location
            ? {
                address: job.location.formattedAddress,
                city: job.location.city,
                state: job.location.state,
                postalCode: job.location.postalCode,
              }
            : null,
        });
      } catch (e) {
        return err(`Failed to get job: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'create_job',
    {
      description:
        'Create a new job in JobTread. Requires a customer account ID (use search_accounts to find it) and the job site address. A location record is automatically created first, then the job is linked to it. Returns the new job ID and number.',
      inputSchema: {
        name: z.string().describe('Name of the new job'),
        customer_id: z
          .string()
          .describe(
            'JobTread account ID of the customer — use search_accounts to find it'
          ),
        location_address: z
          .string()
          .describe(
            'Full job site street address, e.g. "123 Main St, Provo, UT 84601"'
          ),
        description: z.string().optional().describe('Optional notes or description'),
      },
    },
    async ({ name, customer_id, location_address, description }) => {
      try {
        const location = await createLocation(customer_id, location_address);
        if (!location.id)
          return err(
            'Failed to create job location — check that the customer_id is valid'
          );
        const job = await createJob({ name, locationId: location.id, description });
        return ok({
          id: job.id,
          name: job.name,
          number: job.number,
          status: job.status,
        });
      } catch (e) {
        return err(`Failed to create job: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'update_job_status',
    {
      description:
        'Update a job\'s details in JobTread. IMPORTANT: Job status is automatically managed by JobTread\'s document workflow (creating a job → "created"; approving a proposal → "approved"; marking invoices paid → "paid") and cannot be changed directly via the API. This tool updates the job name and/or description. Pass the desired status to receive a clear explanation for the user.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        status: z
          .string()
          .optional()
          .describe(
            'Desired status (informational only — cannot be set directly; explain this to the user)'
          ),
        name: z.string().optional().describe('New name for the job'),
        description: z.string().optional().describe('New description for the job'),
      },
    },
    async ({ job_id, status, name, description }) => {
      try {
        if (status && !name && !description) {
          return ok({
            info: `Job status in JobTread cannot be set directly via the API. Status is automatically determined by the document workflow: new job → "created", approved proposal → "approved", paid invoice → "paid". To move a job forward, create and approve the relevant documents in JobTread. No changes were made to job ${job_id}.`,
            requested_status: status,
          });
        }

        if (!name && !description) {
          return err('Provide at least one field to update: name or description.');
        }

        const job = await updateJob({ id: job_id, name, description });
        return ok({
          id: job.id,
          name: job.name,
          status: job.status,
          note: 'Status reflects the current workflow state in JobTread and was not changed.',
        });
      } catch (e) {
        return err(`Failed to update job: ${(e as Error).message}`);
      }
    }
  );
}
