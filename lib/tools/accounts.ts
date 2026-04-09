import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  searchAccounts,
  getAccount,
  createAccount,
  createContact,
} from '../jobtread/accounts.js';
import { ok, err } from './_helpers.js';

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    'search_accounts',
    {
      description:
        'Search for customer or vendor accounts in JobTread by name. Returns account IDs, names, types, and primary contact info. Use this to find account IDs before calling get_account or create_job.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Name to search for (partial matches supported). Omit to list all accounts.'),
        type: z
          .enum(['customer', 'vendor'])
          .optional()
          .describe('Filter by account type: "customer" or "vendor"'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max results to return (default 10)'),
      },
    },
    async ({ query, type, limit = 10 }) => {
      try {
        const accounts = await searchAccounts(
          query,
          type as 'customer' | 'vendor' | 'subcontractor' | undefined
        );
        const sliced = accounts.slice(0, limit);
        return ok({
          total: sliced.length,
          accounts: sliced.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            primaryContact: a.primaryContact?.name ?? null,
          })),
        });
      } catch (e) {
        return err(`Failed to search accounts: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'get_account',
    {
      description:
        'Get full details for a single account by ID, including all contacts and their associated locations. Use search_accounts to find the account ID first.',
      inputSchema: {
        account_id: z.string().describe('The JobTread account ID'),
      },
    },
    async ({ account_id }) => {
      try {
        const account = await getAccount(account_id);
        if (!account.id) return err(`Account not found: ${account_id}`);

        return ok({
          id: account.id,
          name: account.name,
          type: account.type,
          primaryContact: account.primaryContact
            ? {
                id: account.primaryContact.id,
                name: account.primaryContact.name,
                title: account.primaryContact.title ?? null,
              }
            : null,
          contacts:
            account.contacts?.nodes?.map((c) => ({
              id: c.id,
              name: c.name,
              title: c.title ?? null,
              locations:
                c.locations?.nodes?.map((l) => ({
                  address: l.address,
                  city: l.city,
                  state: l.state,
                  postalCode: l.postalCode,
                })) ?? [],
            })) ?? [],
        });
      } catch (e) {
        return err(`Failed to get account: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'create_account',
    {
      description:
        'Create a new customer or vendor account in JobTread. Optionally add a primary contact name at the same time. Returns the new account ID. Note: email and phone are stored on contacts, not directly on accounts — use the JobTread web interface to add contact details after creation.',
      inputSchema: {
        name: z
          .string()
          .describe('Full company or person name for the account'),
        type: z
          .enum(['customer', 'vendor'])
          .describe('Account type: "customer" or "vendor"'),
        contact_name: z
          .string()
          .optional()
          .describe(
            'Optional primary contact first name to add immediately (e.g. "John" or "John Smith")'
          ),
      },
    },
    async ({ name, type, contact_name }) => {
      try {
        const account = await createAccount({ name, type });
        if (!account.id) return err('Account was not created — no ID returned');

        let contact = null;
        if (contact_name) {
          const parts = contact_name.trim().split(/\s+/);
          const firstName = parts[0];
          const lastName = parts.slice(1).join(' ') || undefined;
          try {
            contact = await createContact(account.id, firstName, lastName);
          } catch {
            // Contact creation failure is non-fatal
          }
        }

        return ok({
          id: account.id,
          name: account.name,
          type: account.type,
          primaryContact: contact
            ? { id: contact.id, name: contact.name }
            : null,
        });
      } catch (e) {
        return err(`Failed to create account: ${(e as Error).message}`);
      }
    }
  );
}
