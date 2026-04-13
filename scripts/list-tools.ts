/**
 * Audit script — builds the MCP server and prints every registered tool.
 * Run with: npx tsx scripts/list-tools.ts
 */

// Stub env vars so assertEnvVars() doesn't throw
process.env.JOBTREAD_GRANT_KEY = 'stub';
process.env.JOBTREAD_ORG_ID = 'stub';
process.env.MCP_API_KEY = 'stub';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerJobTools } from '../lib/tools/jobs.js';
import { registerBudgetTools } from '../lib/tools/budgets.js';
import { registerDocumentTools } from '../lib/tools/documents.js';
import { registerTimeTools } from '../lib/tools/time.js';
import { registerAccountTools } from '../lib/tools/accounts.js';
import { registerTaskTools } from '../lib/tools/tasks.js';
import { registerCommentTools } from '../lib/tools/comments.js';
import { registerLocationTools } from '../lib/tools/locations.js';
import { registerFileTools } from '../lib/tools/files.js';
import { registerSearchTools } from '../lib/tools/search.js';

const GROUPS: Array<[string, (s: McpServer) => void]> = [
  ['jobs',      registerJobTools],
  ['budgets',   registerBudgetTools],
  ['documents', registerDocumentTools],
  ['time',      registerTimeTools],
  ['accounts',  registerAccountTools],
  ['tasks',     registerTaskTools],
  ['comments',  registerCommentTools],
  ['locations', registerLocationTools],
  ['files',     registerFileTools],
  ['search',    registerSearchTools],
];

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'jobtread-mcp', version: '1.0.0' });
  for (const [, register] of GROUPS) register(server);
  return server;
}

const server = buildMcpServer();
const tools = (server as any)._registeredTools as Record<string, unknown>;

// Print grouped by registration order
let globalIdx = 0;
const allNames = Object.keys(tools);

console.log(`\n${'═'.repeat(55)}`);
console.log(`  JobTread MCP — registered tools (${allNames.length} total)`);
console.log(`${'═'.repeat(55)}\n`);

// Re-build per-group to determine group membership
for (const [groupName, register] of GROUPS) {
  const scratch = new McpServer({ name: 'audit', version: '0' });
  register(scratch);
  const groupTools = Object.keys((scratch as any)._registeredTools as Record<string, unknown>);
  console.log(`  ── ${groupName} (${groupTools.length}) ──`);
  for (const name of groupTools) {
    globalIdx++;
    console.log(`    ${String(globalIdx).padStart(2, ' ')}. ${name}`);
  }
}

console.log(`\n  Total: ${globalIdx} tools\n`);
