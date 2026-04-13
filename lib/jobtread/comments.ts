import { paveQuery } from './client.js';
import type { Comment } from '../types.js';

const COMMENT_FIELDS = {
  id: {},
  name: {},
  message: {},
  createdAt: {},
  account: {
    id: {},
    name: {},
  },
};

/**
 * Return all comments on a job, sorted newest-first.
 *
 * NOTE: The JobTread Pave API does not expose a user/author field on comments —
 * only the associated account (business entity) is available.
 */
export async function getJobComments(jobId: string): Promise<Partial<Comment>[]> {
  const data = await paveQuery({
    job: {
      $: { id: jobId },
      comments: {
        $: { size: 100 },
        nodes: COMMENT_FIELDS,
      },
    },
  });

  const comments: Partial<Comment>[] = data?.job?.comments?.nodes ?? [];
  // Return newest first
  return [...comments].reverse();
}

/**
 * Return a single comment by ID.
 */
export async function getComment(commentId: string): Promise<Partial<Comment>> {
  const data = await paveQuery({
    comment: {
      $: { id: commentId },
      ...COMMENT_FIELDS,
      job: {
        id: {},
        name: {},
      },
    },
  });

  return data?.comment ?? {};
}

export interface CreateCommentInput {
  jobId: string;
  /** The comment body text */
  message: string;
  /** Optional subject line */
  subject?: string;
}

/**
 * Create a new comment on a job.
 *
 * The `createComment` mutation requires `targetId` + `targetType: 'job'`
 * (the same pattern as `createTask`). The `name` field sets an optional subject.
 */
export async function createComment(input: CreateCommentInput): Promise<Partial<Comment>> {
  const params: Record<string, unknown> = {
    message: input.message,
    targetId: input.jobId,
    targetType: 'job',
  };
  if (input.subject) params['name'] = input.subject;

  const data = await paveQuery({
    createComment: {
      $: params,
      createdComment: {
        ...COMMENT_FIELDS,
        job: { id: {}, name: {} },
      },
    },
  });

  return data?.createComment?.createdComment ?? {};
}
