import { paveQuery } from './client.js';

// The Pave API does not support server-side filtering by custom field values.
// We fetch all entities with their custom fields and filter client-side.
//
// Response size constraint: including customFieldValues on 100 entities causes
// a 413 error unless the nested customFieldValues list is capped. Testing
// confirmed that cfSize=5 is the maximum that keeps 100 entities within the
// API's response size limit (~20 KB). Entities with more than 5 custom field
// values set will have additional values omitted from the search.
const MAX_ENTITIES = 100;
const CF_SIZE = 5;

export interface CustomFieldMatch {
  id: string;
  name: string;
  entityType: 'job' | 'account';
  status?: string;
  type?: string;
  matchedField: string;
  matchedValue: string;
}

interface RawEntityNode {
  id: string;
  name: string;
  status?: string;
  type?: string;
  customFieldValues?: {
    nodes: Array<{
      value: unknown;
      customField: { name: string; type: string };
    }>;
  };
}

function matchesFilter(
  nodes: RawEntityNode[],
  entityType: 'job' | 'account',
  fieldName: string,
  fieldValue: string
): CustomFieldMatch[] {
  const results: CustomFieldMatch[] = [];
  const nameLower = fieldName.toLowerCase();
  const valueLower = fieldValue.toLowerCase();

  for (const node of nodes) {
    for (const cfv of node.customFieldValues?.nodes ?? []) {
      if (cfv.customField?.name?.toLowerCase() !== nameLower) continue;
      const rawValue = String(cfv.value ?? '').toLowerCase();
      if (rawValue.includes(valueLower)) {
        results.push({
          id: node.id,
          name: node.name,
          entityType,
          status: node.status,
          type: node.type,
          matchedField: cfv.customField.name,
          matchedValue: String(cfv.value ?? ''),
        });
        break; // one match per entity is enough
      }
    }
  }
  return results;
}

export async function searchJobsByCustomField(
  fieldName: string,
  fieldValue: string
): Promise<CustomFieldMatch[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      jobs: {
        $: { size: MAX_ENTITIES },
        nodes: {
          id: {},
          name: {},
          status: {},
          customFieldValues: {
            $: { size: CF_SIZE },
            nodes: {
              value: {},
              customField: { name: {}, type: {} },
            },
          },
        },
      },
    },
  });

  const nodes: RawEntityNode[] = data?.organization?.jobs?.nodes ?? [];
  return matchesFilter(nodes, 'job', fieldName, fieldValue);
}

export async function searchAccountsByCustomField(
  fieldName: string,
  fieldValue: string
): Promise<CustomFieldMatch[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      accounts: {
        $: { size: MAX_ENTITIES },
        nodes: {
          id: {},
          name: {},
          type: {},
          customFieldValues: {
            $: { size: CF_SIZE },
            nodes: {
              value: {},
              customField: { name: {}, type: {} },
            },
          },
        },
      },
    },
  });

  const nodes: RawEntityNode[] = data?.organization?.accounts?.nodes ?? [];
  return matchesFilter(nodes, 'account', fieldName, fieldValue);
}
