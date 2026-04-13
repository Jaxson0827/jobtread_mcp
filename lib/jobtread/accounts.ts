import { paveQuery } from './client.js';
import type { Account, Contact, Location } from '../types.js';

const ACCOUNT_FIELDS = {
  id: {},
  name: {},
  type: {},
  primaryContact: {
    id: {},
    name: {},
    firstName: {},
    lastName: {},
    title: {},
  },
};

/**
 * Lightweight contact fields for list queries (avoids 413 on large accounts).
 * Email and phone are NOT top-level fields on contacts — they are stored as
 * org-defined customFieldValues with types "emailAddress" and "phoneNumber".
 */
const CONTACT_LIST_FIELDS = {
  id: {},
  name: {},
  firstName: {},
  lastName: {},
  title: {},
  createdAt: {},
  customFieldValues: {
    nodes: {
      value: {},
      customField: {
        name: {},
      },
    },
  },
};

/** Full contact fields for single-contact detail queries (includes locations). */
const CONTACT_DETAIL_FIELDS = {
  id: {},
  name: {},
  firstName: {},
  lastName: {},
  title: {},
  createdAt: {},
  customFieldValues: {
    nodes: {
      value: {},
      customField: {
        name: {},
        type: {},
      },
    },
  },
  locations: {
    nodes: {
      id: {},
      name: {},
      address: {},
      formattedAddress: {},
      city: {},
      state: {},
      postalCode: {},
    },
  },
};

/** Extract a named custom field value from a contact (e.g. 'Email', 'Phone') */
export function extractCustomFieldValue(
  contact: Partial<Contact>,
  fieldName: string
): string | null {
  return (
    contact.customFieldValues?.nodes?.find(
      (n) => n.customField?.name?.toLowerCase() === fieldName.toLowerCase()
    )?.value ?? null
  );
}

export type AccountType = 'customer' | 'vendor' | 'subcontractor';

export async function searchAccounts(
  query?: string,
  type?: AccountType
): Promise<Partial<Account>[]> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const data = await paveQuery({
    organization: {
      $: { id: orgId },
      accounts: {
        nodes: ACCOUNT_FIELDS,
      },
    },
  });

  let accounts: Partial<Account>[] = data?.organization?.accounts?.nodes ?? [];

  if (type) {
    accounts = accounts.filter((a) => a.type === type);
  }

  if (query) {
    const lower = query.toLowerCase();
    accounts = accounts.filter(
      (a) =>
        a.name?.toLowerCase().includes(lower) ||
        a.primaryContact?.name?.toLowerCase().includes(lower)
    );
  }

  return accounts;
}

export async function getAccount(id: string): Promise<Partial<Account>> {
  const data = await paveQuery({
    account: {
      $: { id },
      id: {},
      name: {},
      type: {},
      primaryContact: {
        id: {},
        name: {},
        firstName: {},
        lastName: {},
        title: {},
        locations: {
          nodes: {
            id: {},
            name: {},
            address: {},
            city: {},
            state: {},
            postalCode: {},
          },
        },
      },
      contacts: {
        nodes: CONTACT_LIST_FIELDS,
      },
    },
  });
  return data?.account ?? {};
}

export interface CreateAccountInput {
  name: string;
  type?: AccountType;
}

export async function createAccount(input: CreateAccountInput): Promise<Partial<Account>> {
  const orgId = process.env.JOBTREAD_ORG_ID;
  if (!orgId) throw new Error('JOBTREAD_ORG_ID is not set');

  const params: Record<string, unknown> = {
    name: input.name,
    organizationId: orgId,
  };
  if (input.type) params['type'] = input.type;

  const data = await paveQuery({
    createAccount: {
      $: params,
      createdAccount: {
        id: {},
        name: {},
        type: {},
      },
    },
  });
  return data?.createAccount?.createdAccount ?? {};
}

/**
 * Get all contacts for an account, including email/phone from customFieldValues.
 */
// The API returns 413 when requesting size:100 with customFieldValues due to
// response size limits. 50 is the safe maximum.
const CONTACTS_PAGE_SIZE = 50;

export async function getAccountContacts(accountId: string): Promise<Partial<Contact>[]> {
  const data = await paveQuery({
    account: {
      $: { id: accountId },
      contacts: {
        $: { size: CONTACTS_PAGE_SIZE },
        nodes: CONTACT_LIST_FIELDS,
      },
    },
  });
  return data?.account?.contacts?.nodes ?? [];
}

/**
 * Get a single contact by ID, including email/phone and associated account.
 */
export async function getContactById(contactId: string): Promise<Partial<Contact> & { account?: { id: string; name: string } | null }> {
  const data = await paveQuery({
    contact: {
      $: { id: contactId },
      ...CONTACT_DETAIL_FIELDS,
      account: { id: {}, name: {} },
    },
  });
  return data?.contact ?? {};
}

export interface CreateContactInput {
  accountId: string;
  /** Full display name (required by the API) */
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  /**
   * "Lead Source" is a required custom field in this JobTread org.
   * Valid options: Referral, Website, Friend, Internet Search, Social Media.
   * Defaults to "Referral" when not specified.
   */
  leadSource?: string;
}

/**
 * Create a new contact on an existing account.
 *
 * NOTE: Email and phone are stored as org-defined custom fields (not top-level
 * fields). The "Lead Source" custom field is required by this org — it defaults
 * to "Referral" if omitted. Other orgs may not require it.
 */
export async function createContactForAccount(
  input: CreateContactInput
): Promise<Partial<Contact>> {
  const customFieldValues: Record<string, string | null> = {
    'Lead Source': input.leadSource ?? 'Referral',
  };
  if (input.email) customFieldValues['Email'] = input.email;
  if (input.phone) customFieldValues['Phone'] = input.phone;

  const params: Record<string, unknown> = {
    accountId: input.accountId,
    name: input.name,
    customFieldValues,
  };
  if (input.title) params['title'] = input.title;

  const data = await paveQuery({
    createContact: {
      $: params,
      createdContact: {
        id: {},
        name: {},
        firstName: {},
        lastName: {},
        title: {},
        createdAt: {},
        customFieldValues: {
          nodes: {
            value: {},
            customField: { name: {}, type: {} },
          },
        },
        account: { id: {}, name: {} },
      },
    },
  });
  return data?.createContact?.createdContact ?? {};
}

/**
 * Legacy helper used by createAccount — creates a minimal contact using the
 * correct `name` parameter and a default Lead Source.
 */
export async function createContact(
  accountId: string,
  firstName: string,
  lastName?: string,
  title?: string
): Promise<Partial<Contact>> {
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  return createContactForAccount({ accountId, name: fullName, title });
}

export async function createLocation(
  accountId: string,
  address: string
): Promise<Partial<Location>> {
  const data = await paveQuery({
    createLocation: {
      $: { accountId, address },
      createdLocation: {
        id: {},
        name: {},
        address: {},
        formattedAddress: {},
        city: {},
        state: {},
        postalCode: {},
      },
    },
  });
  return data?.createLocation?.createdLocation ?? {};
}
