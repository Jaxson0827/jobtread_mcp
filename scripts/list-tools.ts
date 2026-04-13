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
// accounts module already has get_contacts, get_contact_details, create_contact

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'jobtread-mcp', version: '1.0.0' });
  registerJobTools(server);
  registerBudgetTools(server);
  registerDocumentTools(server);
  registerTimeTools(server);
  registerAccountTools(server);
  registerTaskTools(server);
  registerCommentTools(server);
  registerLocationTools(server);
  return server;
}

const server = buildMcpServer();
// The SDK stores tools in _registeredTools (plain object keyed by tool name)
const tools = (server as any)._registeredTools as Record<string, unknown>;
const names = Object.keys(tools);
console.log(`\nRegistered tools (${names.length} total):\n`);
names.forEach((name, i) => console.log(`  ${String(i + 1).padStart(2, ' ')}. ${name}`));
console.log('');
