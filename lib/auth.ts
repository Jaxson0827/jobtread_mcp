import type { IncomingMessage } from 'node:http';

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = ['JOBTREAD_GRANT_KEY', 'MCP_API_KEY'] as const;

/**
 * Throws immediately if any required environment variables are missing.
 * Called at module load time in api/mcp.ts so failures surface on cold start,
 * not silently on the first request.
 */
export function assertEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[jobtread-mcp] Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in Vercel → Project Settings → Environment Variables.'
    );
  }
}

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

/**
 * Returns true only when the request carries a non-empty x-api-key header
 * that exactly matches the MCP_API_KEY environment variable.
 */
export function validateApiKey(req: IncomingMessage): boolean {
  const key = req.headers['x-api-key'];
  const expected = process.env.MCP_API_KEY;
  // Guard: if MCP_API_KEY is somehow empty at runtime, reject everything
  if (!expected) return false;
  return typeof key === 'string' && key.length > 0 && key === expected;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter  (60 req / min per IP)
// ---------------------------------------------------------------------------
// NOTE: This is process-scoped. Vercel may run multiple isolated instances in
// parallel, so this is a best-effort guard against runaway loops within a
// single instance rather than a cluster-wide hard cap. For stricter enforcement,
// back this with Vercel KV or Redis.

const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

interface RateWindow {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

const rateStore = new Map<string, RateWindow>();

// Prune expired windows every minute to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, w] of rateStore) {
    if (now > w.resetAt) rateStore.delete(ip);
  }
}, WINDOW_MS).unref(); // .unref() lets the process exit normally in tests

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the current window resets — only set when !allowed */
  retryAfterMs?: number;
}

/**
 * Checks and increments the rate counter for the given client IP.
 * Returns { allowed: true } when under the limit, or
 * { allowed: false, retryAfterMs } when the limit is exceeded.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const existing = rateStore.get(ip);

  if (!existing || now > existing.resetAt) {
    // New window
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count++;
  return { allowed: true };
}

/**
 * Extracts the real client IP from Vercel's x-forwarded-for header,
 * falling back to the socket address for local dev.
 */
export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket as { remoteAddress?: string })?.remoteAddress ?? 'unknown';
}
