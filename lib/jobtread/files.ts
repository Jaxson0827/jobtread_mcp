import { paveQuery } from './client.js';
import type { JobFile } from '../types.js';

/**
 * Scalar fields confirmed via Pave API probing.
 *
 * NOT available: updatedAt, mimeType, contentType, extension, filename,
 * thumbnailUrl, width, height, user/createdBy (no uploader field exposed).
 */
const FILE_FIELDS = {
  id: {},
  name: {},
  url: {},
  type: {},
  size: {},
  description: {},
  createdAt: {},
  job: { id: {}, name: {} },
};

/**
 * Return a single file by ID with all available metadata.
 */
export async function getFileById(fileId: string): Promise<Partial<JobFile & { job?: { id: string; name: string } }>> {
  const data = await paveQuery({
    file: {
      $: { id: fileId },
      ...FILE_FIELDS,
    },
  });
  return data?.file ?? {};
}

export interface UpdateFileInput {
  id: string;
  name?: string;
  description?: string | null;
}

/**
 * Update file metadata (name and/or description).
 *
 * The `updateFile` mutation returns an empty `{}` object — to get the updated
 * fields back, we embed a `file` sub-query using the same ID. This is the
 * confirmed pattern from API probing.
 *
 * NOT supported by the API: changing the file content, URL, type, or size.
 * Use upload_file (binary multipart) for that — it is a separate workstream.
 *
 * Confirmed: copyFile mutation does NOT exist in the Pave API.
 */
export async function updateFile(
  input: UpdateFileInput
): Promise<Partial<JobFile & { job?: { id: string; name: string } }>> {
  const params: Record<string, unknown> = { id: input.id };
  if (input.name !== undefined) params['name'] = input.name;
  if (input.description !== undefined) params['description'] = input.description;

  const data = await paveQuery({
    updateFile: {
      $: params,
      // Embed a file query to retrieve the updated record.
      // The mutation itself returns {} — this is the only way to get the result.
      file: {
        $: { id: input.id },
        ...FILE_FIELDS,
      },
    },
  });
  return data?.updateFile?.file ?? {};
}
