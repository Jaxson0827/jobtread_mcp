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

const CONTACT_FIELDS = {
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
};

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
        nodes: CONTACT_FIELDS,
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

export async function createContact(
  accountId: string,
  firstName: string,
  lastName?: string,
  title?: string
): Promise<Partial<Contact>> {
  const params: Record<string, unknown> = { accountId, firstName };
  if (lastName) params['lastName'] = lastName;
  if (title) params['title'] = title;

  const data = await paveQuery({
    createContact: {
      $: params,
      createdContact: {
        id: {},
        name: {},
        firstName: {},
        lastName: {},
        title: {},
      },
    },
  });
  return data?.createContact?.createdContact ?? {};
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
