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

// Expected tool names in registration order — used for startup audit.
const EXPECTED_TOOLS = [
  // jobs (4)
  'search_jobs', 'get_job', 'create_job', 'update_job_status',
  // budgets (4)
  'get_budget', 'add_budget_item', 'get_budget_summary', 'copy_budget',
  // documents (2)
  'list_documents', 'create_document',
  // time (4)
  'log_time', 'get_time_entries', 'create_daily_log', 'get_daily_logs',
  // accounts (4)
  'search_accounts', 'get_account', 'create_account', 'list_users',
] as const;

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'jobtread-mcp',
    version: '1.0.0',
  });

  // Each group is isolated so a failure in one cannot prevent others from loading.
  const groups: Array<[string, () => void]> = [
    ['jobs', () => registerJobTools(server)],
    ['budgets', () => registerBudgetTools(server)],
    ['documents', () => registerDocumentTools(server)],
    ['time', () => registerTimeTools(server)],
    ['accounts', () => registerAccountTools(server)],
  ];

  for (const [name, register] of groups) {
    try {
      register();
    } catch (e) {
      console.error(`[jobtread-mcp] FATAL: failed to register ${name} tools:`, e);
    }
  }

  // Startup audit — logs every registered tool name so Vercel logs show the
  // exact state on each cold start. Warns loudly if the count is wrong.
  const registered = Object.keys(
    (server as unknown as Record<string, Record<string, unknown>>)['_registeredTools'] ?? {}
  );
  const missing = EXPECTED_TOOLS.filter((t) => !registered.includes(t));

  if (missing.length > 0) {
    console.error(
      `[jobtread-mcp] WARNING: ${missing.length} tool(s) failed to register: ${missing.join(', ')}`
    );
  } else {
    console.log(`[jobtread-mcp] All ${registered.length}/18 tools registered: ${registered.join(', ')}`);
  }

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
