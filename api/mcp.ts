import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  assertEnvVars,
  validateApiKey,
  checkRateLimit,
  getClientIp,
} from '../lib/auth.js';
import { registerJobTools } from '../lib/tools/jobs.js';
import { registerBudgetTools } from '../lib/tools/budgets.js';
import { registerDocumentTools } from '../lib/tools/documents.js';
import { registerTimeTools } from '../lib/tools/time.js';
import { registerAccountTools } from '../lib/tools/accounts.js';

// ---------------------------------------------------------------------------
// Startup validation — runs once at cold start, throws immediately if
// JOBTREAD_GRANT_KEY or MCP_API_KEY are missing from the environment.
// ---------------------------------------------------------------------------
assertEnvVars();

// ---------------------------------------------------------------------------
// MCP server factory — fresh instance per request (stateless Vercel model)
// ---------------------------------------------------------------------------
function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'jobtread-mcp',
    version: '1.0.0',
  });

  registerJobTools(server);
  registerBudgetTools(server);
  registerDocumentTools(server);
  registerTimeTools(server);
  registerAccountTools(server);

  return server;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS preflight — must be answered before auth so browsers can probe
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, x-api-key, mcp-session-id'
    );
    return res.status(200).end();
  }

  // 2. Rate limit — checked before API key validation to guard against
  //    brute-force key enumeration as well as accidental runaway loops
  const ip = getClientIp(req);
  const rateResult = checkRateLimit(ip);
  if (!rateResult.allowed) {
    const retryAfterSec = Math.ceil((rateResult.retryAfterMs ?? WINDOW_MS_FALLBACK) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded (60 req/min). Retry after ${retryAfterSec}s.`,
    });
  }

  // 3. API key validation — reject immediately with no data leaked
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 4. GET requests are for SSE streams in stateful mode — not supported here
  if (req.method === 'GET') {
    return res.status(405).setHeader('Allow', 'POST').send('Method Not Allowed');
  }

  // 5. MCP request handling
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session state between requests
  });

  const server = buildMcpServer();

  try {
    await server.connect(transport);
    // req.body is pre-parsed JSON by Vercel's built-in body-parser
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('[jobtread-mcp] Unhandled error in MCP handler:', e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

const WINDOW_MS_FALLBACK = 60_000;
