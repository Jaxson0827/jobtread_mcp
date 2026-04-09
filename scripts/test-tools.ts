/**
 * Integration test: exercises every tool handler directly against the live API.
 * No Vercel CLI needed — imports and calls the same code api/mcp.ts uses.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerJobTools } from '../lib/tools/jobs.js';
import { registerBudgetTools } from '../lib/tools/budgets.js';
import { registerDocumentTools } from '../lib/tools/documents.js';
import { registerTimeTools } from '../lib/tools/time.js';
import { registerAccountTools } from '../lib/tools/accounts.js';

// ---- minimal harness: call a registered tool by name ----
const server = new McpServer({ name: 'test', version: '1.0.0' });
registerJobTools(server);
registerBudgetTools(server);
registerDocumentTools(server);
registerTimeTools(server);
registerAccountTools(server);

// Access internal tool registry (SDK stores them as a plain object at _registeredTools)
const tools = (server as any)._registeredTools as Record<string, any>;

async function callTool(name: string, args: Record<string, unknown>) {
  const tool = tools[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool.handler(args, {});
}

function printResult(name: string, result: any) {
  const isError = result.isError ?? false;
  const text = result.content?.[0]?.text ?? '(no content)';
  const parsed = JSON.parse(text);
  const icon = isError ? '✗' : '✓';
  console.log(`\n${icon} ${name}:`);
  if (isError) {
    console.log('  ERROR:', parsed.error);
  } else {
    console.log(' ', JSON.stringify(parsed).slice(0, 200));
  }
  return !isError;
}

let passed = 0;
let failed = 0;

async function test(toolName: string, args: Record<string, unknown>) {
  try {
    const result = await callTool(toolName, args);
    if (printResult(toolName, result)) passed++; else failed++;
  } catch (e) {
    console.log(`\n✗ ${toolName}: THREW ${(e as Error).message}`);
    failed++;
  }
}

console.log('=== Phase 3 Tool Integration Tests ===\n');
console.log('Registered tools:', Object.keys(tools).join(', '));

// ---- Jobs ----
await test('search_jobs', {});
await test('search_jobs', { query: 'Enduro', status: 'approved' });
await test('get_job', { job_id: '22NysTtLh6LA' });
await test('get_job', { job_id: 'invalid-id-xyz' });
await test('update_job_status', { job_id: '22NysTtLh6LA', status: 'open' });

// ---- Budgets ----
await test('get_budget', { job_id: '22NysTtLh6LA' });
await test('get_budget_summary', { job_ids: ['22NysTtLh6LA', '22NyvUBGq8Xa'] });
await test('add_budget_item', {
  job_id: '22NysTtLh6LA',
  name: 'MCP Test Labor Item',
  quantity: 2,
  unit_cost: 80,
  unit_price: 120,
  cost_code: 'Labor',
});

// ---- Documents ----
await test('list_documents', { job_id: '22NysTtLh6LA' });
await test('list_documents', { job_id: '22NysTtLh6LA', type: 'invoice' });
await test('create_document', {
  job_id: '22NysTtLh6LA',
  type: 'estimate',
  from_name: 'Yeti Welding',
  to_name: "Warner's Construction",
});

// ---- Time ----
await test('get_time_entries', { job_id: '22NysTtLh6LA' });
await test('get_daily_logs', { job_id: '22NysTtLh6LA' });
await test('log_time', {
  job_id: '22NysTtLh6LA',
  hours: 2.5,
  date: '2026-04-09',
  notes: 'MCP integration test — please ignore',
});
await test('create_daily_log', {
  job_id: '22NysTtLh6LA',
  date: '2026-04-09',
  notes: 'MCP integration test log — please ignore',
});

// ---- Accounts ----
await test('search_accounts', {});
await test('search_accounts', { query: 'metal', type: 'vendor' });
await test('get_account', { account_id: '22NysTtFtcui' });
await test('create_account', { name: 'MCP Test Co', type: 'customer', contact_name: 'Jane Smith' });

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) console.log('✅ All tools passed!');
else console.log(`⚠️  ${failed} tool(s) had issues`);
