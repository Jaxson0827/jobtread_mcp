import { paveQuery } from './client.js';
import type { User } from '../types.js';

/**
 * Returns all users visible to the grant key.
 *
 * NOTE: The top-level `users` query returns every entity that can author
 * records in JobTread — this includes human team members AND integration
 * accounts (Stripe, QuickBooks, CompanyCam, etc.). The tool layer filters
 * nothing so Claude can reason about the full list.
 *
 * Available fields: id, name only (email and other personal fields are not
 * exposed by the Pave API on this endpoint).
 */
export async function listUsers(): Promise<User[]> {
  const data = await paveQuery({
    users: {
      $: { size: 100 },
      nodes: {
        id: {},
        name: {},
      },
    },
  });
  return (data?.users?.nodes ?? []) as User[];
}
