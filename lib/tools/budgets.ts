import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getJobCostSummary,
  createCostItem,
  getCostTypes,
  getCostCodes,
} from '../jobtread/budgets.js';
import { ok, err } from './_helpers.js';

/**
 * Resolve a cost code name to { costCodeId, costTypeId }.
 *
 * Strategy:
 * 1. Try to match the string against costType names (Labor, Materials, etc.)
 *    → if matched, pair with the "Uncategorized" costCode
 * 2. Try to match against costCode names (Structural Steel, Railings, etc.)
 *    → if matched, pair with the "Other" costType
 * 3. Default to Uncategorized costCode + Other costType
 */
async function resolveCostCode(
  costCodeName?: string
): Promise<{ costCodeId: string; costTypeId: string; resolvedAs: string }> {
  const [types, codes] = await Promise.all([getCostTypes(), getCostCodes()]);

  const FALLBACK_CODE = codes.find((c) => c.name === 'Uncategorized');
  const FALLBACK_TYPE = types.find((t) => t.name === 'Other');

  if (!FALLBACK_CODE?.id || !FALLBACK_TYPE?.id) {
    throw new Error('Could not find default Uncategorized costCode or Other costType');
  }

  if (!costCodeName) {
    return {
      costCodeId: FALLBACK_CODE.id,
      costTypeId: FALLBACK_TYPE.id,
      resolvedAs: 'Uncategorized / Other (default)',
    };
  }

  const lower = costCodeName.toLowerCase();

  // Match costType name first (Labor, Materials, Subcontractor, etc.)
  const matchedType = types.find((t) => t.name?.toLowerCase() === lower);
  if (matchedType?.id) {
    return {
      costCodeId: FALLBACK_CODE.id,
      costTypeId: matchedType.id,
      resolvedAs: `Uncategorized costCode / ${matchedType.name} costType`,
    };
  }

  // Match costCode name (Structural Steel, Railings, etc.)
  const matchedCode = codes.find((c) => c.name?.toLowerCase().includes(lower));
  if (matchedCode?.id) {
    return {
      costCodeId: matchedCode.id,
      costTypeId: FALLBACK_TYPE.id,
      resolvedAs: `${matchedCode.name} costCode / Other costType`,
    };
  }

  // No match — use defaults
  return {
    costCodeId: FALLBACK_CODE.id,
    costTypeId: FALLBACK_TYPE.id,
    resolvedAs: `Uncategorized / Other (no match found for "${costCodeName}")`,
  };
}

export function registerBudgetTools(server: McpServer): void {
  server.registerTool(
    'get_budget',
    {
      description:
        'Retrieve the full cost breakdown for a job, including all line items with quantities, unit costs, and totals. Also returns aggregate cost and price totals for the job.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const summary = await getJobCostSummary(job_id);
        return ok({
          job_id,
          totalCost: summary.totalCost,
          totalPrice: summary.totalPrice,
          margin:
            summary.totalPrice > 0
              ? `${(((summary.totalPrice - summary.totalCost) / summary.totalPrice) * 100).toFixed(1)}%`
              : null,
          itemCount: summary.itemCount,
          items: summary.items.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unitCost: i.unitCost,
            unitPrice: i.unitPrice,
            totalCost: i.cost,
            totalPrice: i.price,
            costCode: i.costCode?.name ?? null,
          })),
        });
      } catch (e) {
        return err(`Failed to get budget: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'add_budget_item',
    {
      description:
        'Add a new cost line item to a job\'s budget. The cost_code parameter accepts a human-readable name — it is resolved automatically by looking up JobTread cost types (Labor, Materials, Subcontractor, Equipment, etc.) and cost codes. If the name does not match exactly, the closest match is used and reported in the response.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        name: z.string().describe('Name of the budget line item'),
        quantity: z
          .number()
          .positive()
          .describe('Quantity of units (e.g. 8 for 8 hours of labor)'),
        unit_cost: z
          .number()
          .nonnegative()
          .describe('Cost per unit in dollars (e.g. 75 for $75/hr)'),
        unit_price: z
          .number()
          .nonnegative()
          .optional()
          .describe('Sell price per unit in dollars (defaults to unit_cost if omitted)'),
        cost_code: z
          .string()
          .optional()
          .describe(
            'Cost category name, e.g. "Labor", "Materials", "Subcontractor", "Equipment". Resolved to the matching JobTread cost type/code automatically.'
          ),
      },
    },
    async ({ job_id, name, quantity, unit_cost, unit_price, cost_code }) => {
      try {
        const resolved = await resolveCostCode(cost_code);
        const item = await createCostItem({
          jobId: job_id,
          name,
          quantity,
          unitCost: unit_cost,
          unitPrice: unit_price ?? unit_cost,
          costCodeId: resolved.costCodeId,
          costTypeId: resolved.costTypeId,
        });
        return ok({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
          totalCost: item.cost,
          totalPrice: item.price,
          resolvedCostCode: resolved.resolvedAs,
        });
      } catch (e) {
        return err(`Failed to add budget item: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'get_budget_summary',
    {
      description:
        'Get high-level financial totals for one or more jobs — cost, price, and margin. Does not include individual line items. Use get_budget for full itemized detail on a single job.',
      inputSchema: {
        job_ids: z
          .array(z.string())
          .min(1)
          .max(20)
          .describe('Array of JobTread job IDs (1–20)'),
      },
    },
    async ({ job_ids }) => {
      try {
        const results = await Promise.all(
          job_ids.map(async (id) => {
            try {
              const s = await getJobCostSummary(id);
              return {
                job_id: id,
                totalCost: s.totalCost,
                totalPrice: s.totalPrice,
                grossProfit: s.totalPrice - s.totalCost,
                margin:
                  s.totalPrice > 0
                    ? `${(((s.totalPrice - s.totalCost) / s.totalPrice) * 100).toFixed(1)}%`
                    : null,
                itemCount: s.itemCount,
              };
            } catch {
              return { job_id: id, error: 'Failed to fetch' };
            }
          })
        );

        const valid = results.filter((r) => !('error' in r));
        const totalCost = valid.reduce((s, r) => s + (r.totalCost ?? 0), 0);
        const totalPrice = valid.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

        return ok({
          jobs: results,
          aggregate: {
            totalCost,
            totalPrice,
            grossProfit: totalPrice - totalCost,
            margin:
              totalPrice > 0
                ? `${(((totalPrice - totalCost) / totalPrice) * 100).toFixed(1)}%`
                : null,
          },
        });
      } catch (e) {
        return err(`Failed to get budget summary: ${(e as Error).message}`);
      }
    }
  );
}
