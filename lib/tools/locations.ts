import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getAccountLocations,
  getJobLocation,
  createLocation,
} from '../jobtread/locations.js';
import { ok, err } from './_helpers.js';

/** Map a raw location to the clean shape returned to Claude */
function formatLocation(l: Partial<import('../types.js').Location>) {
  return {
    id: l.id,
    name: l.name ?? null,
    address: l.address ?? null,
    formattedAddress: l.formattedAddress ?? null,
    city: l.city ?? null,
    state: l.state ?? null,
    postalCode: l.postalCode ?? null,
    country: l.country ?? null,
    latitude: (l as Record<string, unknown>)['latitude'] ?? null,
    longitude: (l as Record<string, unknown>)['longitude'] ?? null,
    createdAt: (l as Record<string, unknown>)['createdAt'] ?? null,
  };
}

export function registerLocationTools(server: McpServer): void {
  // ── get_locations ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_locations',
    {
      description:
        'Get locations (site addresses) associated with an account or a job. ' +
        'Provide account_id to get all location records linked to that account (there may be several). ' +
        'Provide job_id to get the single location attached to a specific job. ' +
        'At least one of account_id or job_id must be provided. ' +
        'Returns full address details including city, state, zip, country, and GPS coordinates.',
      inputSchema: {
        account_id: z
          .string()
          .optional()
          .describe('JobTread account ID — returns all locations for this account'),
        job_id: z
          .string()
          .optional()
          .describe('JobTread job ID — returns the single location attached to this job'),
      },
    },
    async ({ account_id, job_id }) => {
      if (!account_id && !job_id) {
        return err('At least one of account_id or job_id must be provided.');
      }

      try {
        if (account_id) {
          const locations = await getAccountLocations(account_id);
          return ok({
            source: 'account',
            account_id,
            total: locations.length,
            locations: locations.map(formatLocation),
          });
        }

        // job_id path
        const location = await getJobLocation(job_id!);
        if (!location) {
          return ok({
            source: 'job',
            job_id,
            total: 0,
            locations: [],
            note: 'This job has no location set.',
          });
        }
        return ok({
          source: 'job',
          job_id,
          total: 1,
          locations: [formatLocation(location)],
        });
      } catch (e) {
        return err(`Failed to get locations: ${(e as Error).message}`);
      }
    }
  );

  // ── create_location ────────────────────────────────────────────────────────
  server.registerTool(
    'create_location',
    {
      description:
        'Create a new location (site address) and attach it to an account. ' +
        'The JobTread API geocodes the address string automatically — city, state, and zip ' +
        'are derived from the address and do not need to be passed separately. ' +
        'Include them inline in the address string instead: e.g. "125 W 400 N, Mapleton, UT 84664". ' +
        'The name field sets a short display label (e.g. "Main Office", "Job Site A"). ' +
        'If omitted, the API generates a label from the address.',
      inputSchema: {
        account_id: z
          .string()
          .describe('The JobTread account ID to attach this location to'),
        address: z
          .string()
          .min(1)
          .describe(
            'Full address string including city, state, and zip inline. ' +
            'Example: "125 W 400 N, Mapleton, UT 84664". ' +
            'The API geocodes this to fill city/state/zip/country/GPS automatically.'
          ),
        name: z
          .string()
          .optional()
          .describe(
            'Optional short display label for this location (e.g. "Main Office", "Warehouse"). ' +
            'If omitted, the API derives a label from the address.'
          ),
        city: z
          .string()
          .optional()
          .describe(
            'Informational only — the JobTread API does not accept city as a separate parameter. ' +
            'Include the city directly in the address string instead.'
          ),
        state: z
          .string()
          .optional()
          .describe(
            'Informational only — the JobTread API does not accept state as a separate parameter. ' +
            'Include the state directly in the address string instead.'
          ),
        zip: z
          .string()
          .optional()
          .describe(
            'Informational only — the JobTread API does not accept zip as a separate parameter. ' +
            'Include the zip code directly in the address string instead.'
          ),
      },
    },
    async ({ account_id, address, name, city, state, zip }) => {
      // Remind Claude if it passed city/state/zip separately rather than inline
      const separateParamsPassed = city || state || zip;
      const reminderNote = separateParamsPassed
        ? `Note: city, state, and zip are not accepted as separate API parameters — ` +
          `they should be included inline in the address string. ` +
          `The address "${address}" was geocoded; verify the returned city/state/zip are correct.`
        : undefined;

      try {
        const location = await createLocation({ accountId: account_id, address, name });
        if (!location.id) return err('Location was not created — no ID returned.');

        return ok({
          ...formatLocation(location),
          ...(reminderNote ? { note: reminderNote } : {}),
        });
      } catch (e) {
        return err(`Failed to create location: ${(e as Error).message}`);
      }
    }
  );
}
