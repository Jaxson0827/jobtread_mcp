import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  searchJobsByCustomField,
  searchAccountsByCustomField,
} from '../jobtread/search.js';
import { ok, err } from './_helpers.js';

export function registerSearchTools(server: McpServer): void {
  // ── search_by_custom_field ─────────────────────────────────────────────────
  server.registerTool(
    'search_by_custom_field',
    {
      description:
        'Search jobs and/or accounts by a custom field value. ' +
        'Useful for finding all jobs with a specific "Job Type", all accounts where "W-9" is true, ' +
        'or any other org-defined custom field. ' +
        'The match is case-insensitive and supports partial string matches (substring search). ' +
        'Use get_cost_codes to see available fields, or ask Claude to call this tool to discover values. ' +
        'NOTE: The JobTread API does not support server-side filtering by custom field values — ' +
        'all matching is done client-side after fetching. ' +
        'Due to API response size limits, at most 5 custom field values are examined per entity; ' +
        'entities with more than 5 custom fields set may have additional values not searched. ' +
        'Results are limited to the most recent 100 jobs or 100 accounts.',
      inputSchema: {
        field_name: z
          .string()
          .min(1)
          .describe(
            'The name of the custom field to search (e.g. "Job Type", "Lead Source", "W-9"). ' +
            'Case-insensitive.'
          ),
        field_value: z
          .string()
          .min(1)
          .describe(
            'The value to match (e.g. "Misc Metals", "Referral", "true"). ' +
            'Partial/substring matches are included. Case-insensitive.'
          ),
        entity_type: z
          .enum(['job', 'account'])
          .optional()
          .describe(
            'Restrict search to jobs or accounts. ' +
            'If omitted, both jobs and accounts are searched.'
          ),
      },
    },
    async ({ field_name, field_value, entity_type }) => {
      try {
        const searchJobs = !entity_type || entity_type === 'job';
        const searchAccounts = !entity_type || entity_type === 'account';

        const [jobMatches, accountMatches] = await Promise.all([
          searchJobs ? searchJobsByCustomField(field_name, field_value) : Promise.resolve([]),
          searchAccounts ? searchAccountsByCustomField(field_name, field_value) : Promise.resolve([]),
        ]);

        const results = [...jobMatches, ...accountMatches];

        return ok({
          field_name,
          field_value,
          entity_type: entity_type ?? 'job+account',
          total: results.length,
          job_matches: jobMatches.length,
          account_matches: accountMatches.length,
          results: results.map((r) => ({
            id: r.id,
            name: r.name,
            entityType: r.entityType,
            ...(r.status ? { status: r.status } : {}),
            ...(r.type ? { accountType: r.type } : {}),
            matchedField: r.matchedField,
            matchedValue: r.matchedValue,
          })),
          note:
            'Server-side filtering is not supported by the JobTread API — results are filtered client-side. ' +
            'Up to 5 custom field values per entity are searched; entities with more may not appear in results.',
        });
      } catch (e) {
        return err(`Failed to search by custom field: ${(e as Error).message}`);
      }
    }
  );
}
