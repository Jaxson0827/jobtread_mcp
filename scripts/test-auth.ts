/**
 * Unit tests for lib/auth.ts — no network calls needed.
 */
import {
  assertEnvVars,
  validateApiKey,
  checkRateLimit,
  getClientIp,
} from '../lib/auth.js';
import type { IncomingMessage } from 'node:http';

let pass = 0;
let fail = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

// ---- Helper: build a minimal mock IncomingMessage ----
function mockReq(headers: Record<string, string>): IncomingMessage {
  return { headers, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
}

// ============================================================
console.log('\n--- assertEnvVars ---');

// Should throw when env vars are absent
delete process.env.JOBTREAD_GRANT_KEY;
delete process.env.MCP_API_KEY;
try {
  assertEnvVars();
  assert('throws when JOBTREAD_GRANT_KEY and MCP_API_KEY missing', false);
} catch (e) {
  const msg = (e as Error).message;
  assert('throws when both missing', msg.includes('JOBTREAD_GRANT_KEY') && msg.includes('MCP_API_KEY'));
}

process.env.JOBTREAD_GRANT_KEY = 'test-grant-key';
try {
  assertEnvVars();
  assert('throws when only MCP_API_KEY missing', false);
} catch (e) {
  const msg = (e as Error).message;
  assert('throws when MCP_API_KEY missing only', msg.includes('MCP_API_KEY') && !msg.includes('JOBTREAD_GRANT_KEY'));
}

process.env.MCP_API_KEY = 'test-mcp-key';
try {
  assertEnvVars();
  assert('does not throw when all env vars set', true);
} catch {
  assert('does not throw when all env vars set', false);
}

// ============================================================
console.log('\n--- validateApiKey ---');

process.env.MCP_API_KEY = 'secret-key-123';

assert('valid key accepted', validateApiKey(mockReq({ 'x-api-key': 'secret-key-123' })));
assert('wrong key rejected', !validateApiKey(mockReq({ 'x-api-key': 'wrong-key' })));
assert('empty key rejected', !validateApiKey(mockReq({ 'x-api-key': '' })));
assert('missing header rejected', !validateApiKey(mockReq({})));
assert('array header rejected', !validateApiKey({ headers: { 'x-api-key': ['k1', 'k2'] }, socket: {} } as any));

// Guard: empty MCP_API_KEY rejects everything
process.env.MCP_API_KEY = '';
assert('rejects everything when MCP_API_KEY is empty', !validateApiKey(mockReq({ 'x-api-key': '' })));
process.env.MCP_API_KEY = 'secret-key-123';

// ============================================================
console.log('\n--- getClientIp ---');

assert(
  'extracts first IP from x-forwarded-for',
  getClientIp(mockReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })) === '1.2.3.4'
);
assert(
  'falls back to socket address',
  getClientIp(mockReq({})) === '127.0.0.1'
);
assert(
  'handles single IP',
  getClientIp(mockReq({ 'x-forwarded-for': '9.9.9.9' })) === '9.9.9.9'
);

// ============================================================
console.log('\n--- checkRateLimit (isolated IP namespace per test) ---');

const testIp = `test-ip-${Date.now()}`;

// First 60 requests should be allowed
let allAllowed = true;
for (let i = 0; i < 60; i++) {
  if (!checkRateLimit(testIp).allowed) { allAllowed = false; break; }
}
assert('first 60 requests allowed', allAllowed);

// 61st should be blocked
const blocked = checkRateLimit(testIp);
assert('61st request blocked', !blocked.allowed);
assert('retryAfterMs is a positive number', typeof blocked.retryAfterMs === 'number' && blocked.retryAfterMs > 0);

// Different IP is independent
const otherIp = `other-ip-${Date.now()}`;
assert('different IP is not rate limited', checkRateLimit(otherIp).allowed);

// ============================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('✅ All auth tests passed!');
else process.exit(1);
