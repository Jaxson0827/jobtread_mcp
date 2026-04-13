import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  searchAccounts,
  getAccount,
  createAccount,
  createContact,
  getAccountContacts,
  getContactById,
  createContactForAccount,
  extractCustomFieldValue,
} from '../jobtread/accounts.js';
import { listUsers } from '../jobtread/users.js';
import { ok, err } from './_helpers.js';

/** Map a raw contact to the clean shape returned to Claude */
function formatContact(c: Partial<import('../types.js').Contact> & { account?: { id: string; name: string } | null }) {
  return {
    id: c.id,
    name: c.name,
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    title: c.title ?? null,
    email: extractCustomFieldValue(c, 'Email'),
    phone: extractCustomFieldValue(c, 'Phone'),
    createdAt: c.createdAt ?? null,
    locations:
      c.locations?.nodes?.map((l) => ({
        id: l.id,
        formattedAddress: l.formattedAddress ?? l.address ?? null,
        city: l.city ?? null,
        state: l.state ?? null,
        postalCode: l.postalCode ?? null,
      })) ?? [],
    account: c.account ? { id: c.account.id, name: c.account.name } : undefined,
  };
}

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

  server.registerTool(
    'list_users',
    {
      description:
        'List all users in the JobTread organization. ' +
        'Returns every user ID and name — including both human team members and integration accounts ' +
        '(e.g. QuickBooks, CompanyCam). Use this to resolve a person\'s name to their user ID before ' +
        'logging time on their behalf. ' +
        'NOTE: The JobTread API only exposes id and name for users — email is not available via this API.',
      inputSchema: {},
    },
    async () => {
      try {
        const users = await listUsers();
        return ok({
          total: users.length,
          users: users.map((u) => ({ id: u.id, name: u.name })),
        });
      } catch (e) {
        return err(`Failed to list users: ${(e as Error).message}`);
      }
    }
  );

  // ── get_contacts ───────────────────────────────────────────────────────────
  server.registerTool(
    'get_contacts',
    {
      description:
        'Get all contacts associated with an account, including name, title, email, and phone. ' +
        'NOTE: Email and phone are stored as org-defined custom fields in JobTread — ' +
        'they are extracted and presented as top-level fields for convenience. ' +
        'Address/location details are not included in the list — use get_contact_details for full address info. ' +
        'Use get_account or search_accounts to find the account_id first.',
      inputSchema: {
        account_id: z.string().describe('The JobTread account ID'),
      },
    },
    async ({ account_id }) => {
      try {
        const contacts = await getAccountContacts(account_id);
        return ok({
          account_id,
          total: contacts.length,
          contacts: contacts.map(formatContact),
        });
      } catch (e) {
        return err(`Failed to get contacts: ${(e as Error).message}`);
      }
    }
  );

  // ── get_contact_details ────────────────────────────────────────────────────
  server.registerTool(
    'get_contact_details',
    {
      description:
        'Get full details for a single contact by their ID, including name, title, email, phone, ' +
        'all associated addresses, and the account they belong to. ' +
        'Use get_contacts to list contacts for an account and find a contact ID.',
      inputSchema: {
        contact_id: z.string().describe('The JobTread contact ID'),
      },
    },
    async ({ contact_id }) => {
      try {
        const contact = await getContactById(contact_id);
        if (!contact.id) return err(`Contact not found: ${contact_id}`);
        return ok(formatContact(contact));
      } catch (e) {
        return err(`Failed to get contact details: ${(e as Error).message}`);
      }
    }
  );

  // ── create_contact ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_contact',
    {
      description:
        'Add a new contact to an existing account. ' +
        'Supports name, title, email, and phone. ' +
        'Email and phone are stored as org-defined custom fields, not top-level fields — ' +
        'they will be visible in the JobTread web interface under the contact\'s custom fields section. ' +
        'The "lead_source" field is required by this JobTread organization — valid options are: ' +
        '"Referral", "Website", "Friend", "Internet Search", "Social Media". Defaults to "Referral" if omitted.',
      inputSchema: {
        account_id: z.string().describe('The JobTread account ID to add the contact to'),
        name: z.string().min(1).describe('Full name of the contact (e.g. "Jane Smith")'),
        title: z.string().optional().describe('Job title or role (e.g. "Project Manager")'),
        email: z.string().email().optional().describe('Contact email address'),
        phone: z.string().optional().describe('Contact phone number'),
        lead_source: z
          .enum(['Referral', 'Website', 'Friend', 'Internet Search', 'Social Media'])
          .optional()
          .describe(
            'How this contact was sourced. Required by this org. Valid values: Referral, Website, Friend, Internet Search, Social Media. Defaults to "Referral".'
          ),
      },
    },
    async ({ account_id, name, title, email, phone, lead_source }) => {
      try {
        const contact = await createContactForAccount({
          accountId: account_id,
          name,
          title,
          email,
          phone,
          leadSource: lead_source,
        });
        if (!contact.id) return err('Contact was not created — no ID returned');
        return ok(formatContact(contact));
      } catch (e) {
        return err(`Failed to create contact: ${(e as Error).message}`);
      }
    }
  );
}
