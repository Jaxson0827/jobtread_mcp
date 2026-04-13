import { paveQuery } from './client.js';
import type { CostItem, CostCode, CostType } from '../types.js';

const COST_ITEM_FIELDS = {
  id: {},
  name: {},
  description: {},
  quantity: {},
  unitCost: {},
  unitPrice: {},
  cost: {},
  price: {},
  costCode: {
    id: {},
    name: {},
  },
  costType: {
    id: {},
    name: {},
  },
};

export async function getJobCostItems(jobId: string): Promise<Partial<CostItem>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      costItems: {
        nodes: COST_ITEM_FIELDS,
      },
    },
  });
  return data?.job?.costItems?.nodes ?? [];
}

export async function getCostTypes(): Promise<Partial<CostType>[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      costTypes: {
        nodes: { id: {}, name: {} },
      },
    },
  });
  return data?.organization?.costTypes?.nodes ?? [];
}

export async function getCostCodes(): Promise<Partial<CostCode>[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      costCodes: {
        nodes: { id: {}, name: {} },
      },
    },
  });
  return data?.organization?.costCodes?.nodes ?? [];
}

export async function getOrgCostItems(): Promise<Partial<CostItem>[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      costItems: {
        nodes: COST_ITEM_FIELDS,
      },
    },
  });
  return data?.organization?.costItems?.nodes ?? [];
}

export interface CreateCostItemInput {
  jobId: string;
  name: string;
  costCodeId: string;
  costTypeId: string;
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
}

export async function createCostItem(input: CreateCostItemInput): Promise<Partial<CostItem>> {
  const params: Record<string, unknown> = {
    name: input.name,
    jobId: input.jobId,
    costCodeId: input.costCodeId,
    costTypeId: input.costTypeId,
  };
  if (input.quantity !== undefined) params['quantity'] = input.quantity;
  if (input.unitCost !== undefined) params['unitCost'] = input.unitCost;
  if (input.unitPrice !== undefined) params['unitPrice'] = input.unitPrice;

  const data = await paveQuery({
    createCostItem: {
      $: params,
      createdCostItem: {
        id: {},
        name: {},
        cost: {},
        price: {},
        quantity: {},
        unitCost: {},
        unitPrice: {},
      },
    },
  });
  return data?.createCostItem?.createdCostItem ?? {};
}

export async function deleteCostItem(id: string): Promise<void> {
  await paveQuery({ deleteCostItem: { $: { id } } });
}

export interface CostSummary {
  totalCost: number;
  totalPrice: number;
  itemCount: number;
  items: Partial<CostItem>[];
}

export async function getJobCostSummary(jobId: string): Promise<CostSummary> {
  const items = await getJobCostItems(jobId);
  return {
    totalCost: items.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    totalPrice: items.reduce((sum, i) => sum + (i.price ?? 0), 0),
    itemCount: items.length,
    items,
  };
}
