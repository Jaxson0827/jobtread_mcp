import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listDocuments, getDocument, createDocument } from '../jobtread/documents.js';
import type { DocumentType } from '../jobtread/documents.js';
import { ok, err } from './_helpers.js';

/** Map spec-facing type names to the JobTread API type values */
const TYPE_MAP: Record<string, DocumentType> = {
  estimate: 'customerOrder',
  proposal: 'customerOrder',
  customer_order: 'customerOrder',
  invoice: 'customerInvoice',
  customer_invoice: 'customerInvoice',
  expense: 'vendorBill',
  vendor_bill: 'vendorBill',
  purchase_order: 'vendorBill',
  bid_request: 'customerOrder',
};

function resolveDocType(input: string): DocumentType {
  return TYPE_MAP[input.toLowerCase()] ?? (input as DocumentType);
}

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    'list_documents',
    {
      description:
        'List all documents attached to a job — proposals, invoices, and expenses. Each document shows its type, status, balance, and dates. Optionally filter by type or status.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        type: z
          .string()
          .optional()
          .describe(
            'Filter by document type: "estimate"/"proposal", "invoice", "expense"/"purchase_order"'
          ),
        status: z
          .string()
          .optional()
          .describe('Filter by status: "approved", "draft", "void", etc.'),
      },
    },
    async ({ job_id, type, status }) => {
      try {
        let docs = await listDocuments(job_id);

        if (type) {
          const apiType = resolveDocType(type);
          docs = docs.filter((d) => d.type === apiType);
        }

        if (status) {
          const lower = status.toLowerCase();
          docs = docs.filter((d) => d.status?.toLowerCase() === lower);
        }

        return ok({
          job_id,
          total: docs.length,
          documents: docs.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            status: d.status,
            number: d.number,
            balance: d.balance,
            dueDate: d.dueDate ?? null,
            createdAt: d.createdAt,
          })),
        });
      } catch (e) {
        return err(`Failed to list documents: ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    'create_document',
    {
      description:
        'Create a new document (proposal/estimate, invoice, or vendor expense) for a job. ' +
        'IMPORTANT LIMITATION: The job must have a valid location configured in JobTread. If the API returns "A job location name or address is required", the job\'s location is missing — ask the user to set it in JobTread first. ' +
        'Document types: "estimate"/"proposal" → customer proposal; "invoice" → customer invoice; "expense"/"purchase_order" → vendor bill.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
        type: z
          .string()
          .describe(
            'Document type: "estimate", "proposal", "invoice", "expense", or "purchase_order"'
          ),
        name: z
          .string()
          .optional()
          .describe('Document title (defaults to job name + type if omitted)'),
        from_name: z
          .string()
          .optional()
          .describe('Your company name to appear on the document (defaults to "Yeti Welding")'),
        to_name: z
          .string()
          .optional()
          .describe('Recipient name — customer or vendor name on the document'),
        tax_rate: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe('Tax rate as a decimal (e.g. 0.08 for 8%). Defaults to 0.'),
      },
    },
    async ({ job_id, type, name, from_name, to_name, tax_rate }) => {
      try {
        const docType = resolveDocType(type);
        const orgName =
          from_name ??
          (process.env.JOBTREAD_ORG_NAME ?? 'Yeti Welding');

        let docName = name;
        if (!docName) {
          const typeLabel =
            docType === 'customerOrder'
              ? 'Proposal'
              : docType === 'customerInvoice'
                ? 'Invoice'
                : 'Expense';
          docName = typeLabel;
        }

        const doc = await createDocument({
          jobId: job_id,
          name: docName,
          type: docType,
          fromName: orgName,
          toName: to_name ?? orgName,
          taxRate: tax_rate ?? 0,
        });

        return ok({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          status: doc.status,
          number: doc.number,
        });
      } catch (e) {
        const message = (e as Error).message;
        if (message.toLowerCase().includes('location')) {
          return err(
            'Cannot create document: this job does not have a valid location configured in JobTread. ' +
              'Please set the job site address in the JobTread web interface, then try again.'
          );
        }
        return err(`Failed to create document: ${message}`);
      }
    }
  );
}
