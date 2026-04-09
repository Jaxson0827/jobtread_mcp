import { paveQuery } from './client.js';
import type { Document } from '../types.js';

const DOCUMENT_FIELDS = {
  id: {},
  name: {},
  type: {},
  status: {},
  number: {},
  balance: {},
  tax: {},
  taxRate: {},
  dueDate: {},
  description: {},
  createdAt: {},
  fromName: {},
  toName: {},
  fromAddress: {},
  toAddress: {},
};

export type DocumentType =
  | 'customerOrder'
  | 'customerInvoice'
  | 'vendorBill';

export async function listDocuments(jobId: string): Promise<Partial<Document>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      documents: {
        nodes: DOCUMENT_FIELDS,
      },
    },
  });
  return data?.job?.documents?.nodes ?? [];
}

export async function getDocument(id: string): Promise<Partial<Document>> {
  const data = await paveQuery({
    document: {
      $: { id },
      ...DOCUMENT_FIELDS,
      account: { id: {}, name: {} },
      job: { id: {}, name: {} },
    },
  });
  return data?.document ?? {};
}

export interface CreateDocumentInput {
  jobId: string;
  name: string;
  type: DocumentType;
  fromName: string;
  toName: string;
  taxRate?: number;
  fromAddress?: string;
  toAddress?: string;
}

/**
 * Create a document (proposal, invoice, or expense) on a job.
 * NOTE: The job must have a valid location (address/name) set in JobTread.
 * If the API returns "A job location name or address is required", ensure the
 * job has a location linked via the JobTread web interface.
 */
export async function createDocument(input: CreateDocumentInput): Promise<Partial<Document>> {
  const params: Record<string, unknown> = {
    name: input.name,
    jobId: input.jobId,
    type: input.type,
    fromName: input.fromName,
    toName: input.toName,
    taxRate: input.taxRate ?? 0,
  };
  if (input.fromAddress) params['fromAddress'] = input.fromAddress;
  if (input.toAddress) params['toAddress'] = input.toAddress;

  const data = await paveQuery({
    createDocument: {
      $: params,
      createdDocument: {
        id: {},
        name: {},
        type: {},
        status: {},
        number: {},
      },
    },
  });
  return data?.createDocument?.createdDocument ?? {};
}

export async function getDocumentsByType(
  jobId: string,
  type: DocumentType
): Promise<Partial<Document>[]> {
  const all = await listDocuments(jobId);
  return all.filter((d) => d.type === type);
}
