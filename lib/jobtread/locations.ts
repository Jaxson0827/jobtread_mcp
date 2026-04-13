import { paveQuery } from './client.js';
import { createLocation as createLocationRecord } from './accounts.js';
import type { Location } from '../types.js';

/**
 * All confirmed scalar fields for a location.
 * city, state, postalCode, and country are populated automatically by the
 * JobTread geocoder from the address string — they cannot be set directly.
 */
export const LOCATION_FIELDS = {
  id: {},
  name: {},
  address: {},
  formattedAddress: {},
  city: {},
  state: {},
  postalCode: {},
  country: {},
  latitude: {},
  longitude: {},
  createdAt: {},
};

/**
 * Return all locations associated with an account.
 *
 * Locations are stored on contacts in JobTread but are also accessible
 * directly via `account.locations` — this endpoint aggregates all location
 * records linked to any contact under the account.
 */
export async function getAccountLocations(accountId: string): Promise<Partial<Location>[]> {
  const data = await paveQuery({
    account: {
      $: { id: accountId },
      locations: {
        $: { size: 100 },
        nodes: LOCATION_FIELDS,
      },
    },
  });
  return data?.account?.locations?.nodes ?? [];
}

/**
 * Return the single location attached to a job.
 *
 * NOTE: The Pave API exposes `job.location` (singular), not `job.locations`.
 * A job can have at most one location record.
 * Returns null if the job has no location set.
 */
export async function getJobLocation(jobId: string): Promise<Partial<Location> | null> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      location: LOCATION_FIELDS,
    },
  });
  const loc = data?.job?.location;
  return loc && loc.id ? (loc as Partial<Location>) : null;
}

export interface CreateLocationInput {
  /** Account ID to attach the location to */
  accountId: string;
  /**
   * Full address string. Include city/state/zip inline — the API geocodes the
   * address and fills those fields automatically. There are no separate city,
   * state, or zip parameters on createLocation.
   * Example: "125 W 400 N, Mapleton, UT 84664"
   */
  address: string;
  /**
   * Optional display label for the location (e.g. "Main Office", "Job Site A").
   * If omitted the API derives a short name from the address.
   */
  name?: string;
  /**
   * Optional contact ID to associate this location with a specific contact
   * under the account.
   */
  contactId?: string;
}

/**
 * Create a new location record attached to an account.
 *
 * Delegates to the existing createLocation helper in accounts.ts for the
 * base call, then handles the optional `name` parameter separately since the
 * existing helper only takes accountId + address.
 */
export async function createLocation(input: CreateLocationInput): Promise<Partial<Location>> {
  const params: Record<string, unknown> = {
    accountId: input.accountId,
    address: input.address,
  };
  if (input.name) params['name'] = input.name;
  if (input.contactId) params['contactId'] = input.contactId;

  const data = await paveQuery({
    createLocation: {
      $: params,
      createdLocation: LOCATION_FIELDS,
    },
  });
  return data?.createLocation?.createdLocation ?? {};
}

// Re-export the legacy function so callers that depended on the accounts.ts
// export continue to work without modification.
export { createLocationRecord };
