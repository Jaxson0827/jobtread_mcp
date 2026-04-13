import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getJobComments, getComment, createComment } from '../jobtread/comments.js';
import { ok, err } from './_helpers.js';

/** Map a raw comment to the clean shape returned to Claude */
function formatComment(c: Partial<import('../types.js').Comment>) {
  return {
    id: c.id,
    subject: c.name ?? null,
    message: c.message,
    author: c.account?.name ?? null,
    createdAt: c.createdAt,
  };
}

export function registerCommentTools(server: McpServer): void {
  // ── get_comments ───────────────────────────────────────────────────────────
  server.registerTool(
    'get_comments',
    {
      description:
        'Get all comments on a job, ordered newest first. ' +
        'Each comment includes the message text, an optional subject line, the author account name, and timestamp. ' +
        'NOTE: The JobTread API exposes only the account name (business entity) as the author — ' +
        'individual user names are not available on comments.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID'),
      },
    },
    async ({ job_id }) => {
      try {
        const comments = await getJobComments(job_id);
        return ok({
          job_id,
          total: comments.length,
          comments: comments.map(formatComment),
        });
      } catch (e) {
        return err(`Failed to get comments: ${(e as Error).message}`);
      }
    }
  );

  // ── get_comment_details ────────────────────────────────────────────────────
  server.registerTool(
    'get_comment_details',
    {
      description:
        'Get full details for a single comment by its ID. ' +
        'Returns message text, subject, author account, timestamp, and the job the comment is attached to. ' +
        'Use get_comments first to find the comment ID.',
      inputSchema: {
        comment_id: z.string().describe('The JobTread comment ID'),
      },
    },
    async ({ comment_id }) => {
      try {
        const comment = await getComment(comment_id);
        if (!comment.id) return err(`Comment not found: ${comment_id}`);
        return ok({
          ...formatComment(comment),
          job: comment.job ? { id: comment.job.id, name: comment.job.name } : null,
        });
      } catch (e) {
        return err(`Failed to get comment details: ${(e as Error).message}`);
      }
    }
  );

  // ── create_comment ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_comment',
    {
      description:
        'Create a new comment on a job, visible to the whole team. ' +
        'Comments are the primary way to leave notes, updates, or messages on a job. ' +
        'The comment will appear in the job activity feed immediately.',
      inputSchema: {
        job_id: z.string().describe('The JobTread job ID to post the comment on'),
        content: z.string().min(1).describe('The comment text / message body'),
        subject: z
          .string()
          .optional()
          .describe('Optional subject line or title for the comment'),
      },
    },
    async ({ job_id, content, subject }) => {
      try {
        const comment = await createComment({
          jobId: job_id,
          message: content,
          subject,
        });

        return ok({
          ...formatComment(comment),
          job: comment.job ? { id: comment.job.id, name: comment.job.name } : null,
          message: 'Comment posted successfully.',
        });
      } catch (e) {
        return err(`Failed to create comment: ${(e as Error).message}`);
      }
    }
  );
}
