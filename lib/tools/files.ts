import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getJobFiles } from '../jobtread/jobs.js';
import { getFileById, updateFile } from '../jobtread/files.js';
import { ok, err } from './_helpers.js';

/** Map a raw file node to the clean shape returned to Claude */
function formatFile(f: Partial<{ id: string; name: string; url: string | null; type: string | null; size: number | null; description: string | null; createdAt: string; job?: { id: string; name: string } }>) {
  return {
    id: f.id,
    name: f.name,
    url: f.url ?? null,
    mimeType: f.type ?? null,
    sizeBytes: f.size ?? null,
    description: f.description ?? null,
    createdAt: f.createdAt ?? null,
  };
}

export function registerFileTools(server: McpServer): void {
  // ── get_files ──────────────────────────────────────────────────────────────
  server.registerTool(
    'get_files',
    {
      description:
        'Get all files attached to a job (photos, PDFs, documents, and other attachments). ' +
        'Returns each file\'s name, MIME type, size in bytes, upload date, and download URL. ' +
        'The download URL is a signed CDN link that can be opened directly in a browser or shared with a user. ' +
        'NOTE: The JobTread API does not expose a folder structure — all files are returned as a flat list. ' +
        'For contract/invoice documents (estimates, invoices) use list_documents instead.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const files = await getJobFiles(job_id);
        return ok({
          job_id,
          total: files.length,
          files: files.map(formatFile),
        });
      } catch (e) {
        return err(`Failed to get files: ${(e as Error).message}`);
      }
    }
  );

  // ── get_file_details ───────────────────────────────────────────────────────
  server.registerTool(
    'get_file_details',
    {
      description:
        'Get full metadata for a single file by its ID. ' +
        'Returns name, MIME type, size in bytes, description, upload date, download URL, and the job it belongs to. ' +
        'Use get_files to list all files for a job and discover file IDs.',
      inputSchema: {
        file_id: z.string().describe('The JobTread file ID'),
      },
    },
    async ({ file_id }) => {
      try {
        const file = await getFileById(file_id);
        if (!file.id) return err(`File not found: ${file_id}`);
        return ok({
          ...formatFile(file),
          job: file.job ? { id: file.job.id, name: file.job.name } : null,
        });
      } catch (e) {
        return err(`Failed to get file details: ${(e as Error).message}`);
      }
    }
  );

  // ── read_file ──────────────────────────────────────────────────────────────
  server.registerTool(
    'read_file',
    {
      description:
        'Get the download URL for a file so it can be presented to the user or opened in a browser. ' +
        'The URL is a signed CDN link — share it directly with the user to view or download the file. ' +
        'Also returns the file name and MIME type so the user knows what they\'re opening. ' +
        'Use get_files first to find the file ID.',
      inputSchema: {
        file_id: z.string().describe('The JobTread file ID'),
      },
    },
    async ({ file_id }) => {
      try {
        const file = await getFileById(file_id);
        if (!file.id) return err(`File not found: ${file_id}`);
        if (!file.url) return err(`File ${file_id} has no download URL available.`);
        return ok({
          id: file.id,
          name: file.name,
          mimeType: file.type ?? null,
          downloadUrl: file.url,
        });
      } catch (e) {
        return err(`Failed to read file: ${(e as Error).message}`);
      }
    }
  );

  // ── update_file ────────────────────────────────────────────────────────────
  server.registerTool(
    'update_file',
    {
      description:
        'Update the metadata for a file — specifically its display name and/or description. ' +
        'Only metadata can be changed via the API; file content, type, and size cannot be updated this way. ' +
        'To replace a file\'s content, a binary upload (multipart) is required — that is a separate workstream not covered by this tool. ' +
        'NOTE: copy_file is not supported by the JobTread API — there is no copyFile mutation available.',
      inputSchema: {
        file_id: z.string().describe('The JobTread file ID to update'),
        name: z
          .string()
          .min(1)
          .optional()
          .describe('New display name for the file (e.g. "Site Photo - Front Elevation")'),
        description: z
          .string()
          .optional()
          .describe('New description or caption for the file. Pass an empty string to clear the existing description.'),
      },
    },
    async ({ file_id, name, description }) => {
      if (name === undefined && description === undefined) {
        return err('At least one of name or description must be provided.');
      }
      try {
        const file = await updateFile({ id: file_id, name, description });
        if (!file.id) return err(`File not found or update failed: ${file_id}`);
        return ok({
          ...formatFile(file),
          job: file.job ? { id: file.job.id, name: file.job.name } : null,
          message: 'File updated successfully.',
        });
      } catch (e) {
        return err(`Failed to update file: ${(e as Error).message}`);
      }
    }
  );
}
