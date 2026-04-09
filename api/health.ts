import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/health
 *
 * Unauthenticated health check endpoint — no auth required.
 * Used for Vercel uptime monitoring and deployment verification.
 * Returns 200 with a JSON status payload.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).setHeader('Allow', 'GET').send('Method Not Allowed');
  }

  const envStatus = {
    JOBTREAD_GRANT_KEY: !!process.env.JOBTREAD_GRANT_KEY,
    MCP_API_KEY: !!process.env.MCP_API_KEY,
    JOBTREAD_ORG_ID: !!process.env.JOBTREAD_ORG_ID,
  };

  const allEnvSet = Object.values(envStatus).every(Boolean);

  return res.status(200).json({
    status: allEnvSet ? 'ok' : 'degraded',
    version: '1.0.0',
    service: 'jobtread-mcp',
    timestamp: new Date().toISOString(),
    env: envStatus,
  });
}
