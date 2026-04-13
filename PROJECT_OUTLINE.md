# JobTread MCP Server � Project Outline

**Version:** 1.0 | **Date:** April 09, 2026 | **Classification:** Internal / Confidential

A custom Model Context Protocol (MCP) server that connects Claude (and other AI models) directly to a JobTread account, hosted on Vercel.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [JobTread API Reference](#4-jobtread-api-reference)
5. [MCP Tool Specifications](#5-mcp-tool-specifications)
6. [Project Structure](#6-project-structure)
7. [Implementation Guide](#7-implementation-guide)
8. [Security & Authentication](#8-security--authentication)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Operations](#10-deployment--operations)
11. [Build Phases & Timeline](#11-build-phases--timeline)
12. [Appendix](#12-appendix)

---

## 1. Project Overview

### 1.1 Purpose & Goals

Build a custom MCP server that bridges Claude AI with a company's JobTread account, allowing any team member to interact with JobTread data through natural language conversation with Claude.

**Primary Goals:**
- Enable Claude to read and write live JobTread data
- Host on Vercel so all team members share a single endpoint
- Support all major AI models (Claude, ChatGPT, Gemini, Grok)
- Cover core operations: jobs, budgets, documents, time logs, contacts
- Keep codebase clean, modular, and easy to extend
- Secure the endpoint so only authorized team members can access it

**Out of Scope (v1):**
- Replicating every DATAx feature (Zillow, Google Drive sync, Cashflow Calendar, etc.)
- Building a user-facing UI or dashboard
- Per-user authentication (v1 uses a shared company grant key)
- Real-time webhooks or push notifications from JobTread

### 1.2 What Is MCP?

Model Context Protocol (MCP) is an open standard introduced by Anthropic in November 2024. It defines a standardized way for AI models to connect to external tools and data sources � a universal interface that lets any MCP-compatible AI assistant connect to any MCP server. Now maintained by the Linux Foundation; supported by Claude, ChatGPT, Gemini, Cursor, VS Code, and more.

An MCP server exposes named **tools**. Each tool has a name, description (which the AI reads to decide what to use), and an input schema.

### 1.3 How It Works End-to-End

| Step | Actor | Action |
|------|-------|--------|
| 1 | User | Types a request in Claude: "Find all open jobs for ABC Construction" |
| 2 | Claude | Reads available tools, selects `search_jobs` with appropriate parameters |
| 3 | Claude ? MCP Server | Sends an HTTP POST to the Vercel endpoint with tool name and inputs |
| 4 | MCP Server | Validates the request, constructs a Pave query for the JobTread API |
| 5 | MCP Server ? JobTread | Sends authenticated API request to `api.jobtread.com/pave` |
| 6 | JobTread | Returns matching job data as JSON |
| 7 | MCP Server ? Claude | Formats and returns the data to Claude |
| 8 | Claude ? User | Summarizes the results in natural language |

---

## 2. Architecture

### 2.1 System Architecture

```
Claude.ai / Claude Desktop  ?  Vercel MCP Server (/api/mcp)  ?  JobTread API (api.jobtread.com/pave)
      [MCP Client]               [Streamable HTTP POST]              [Pave Query Language]
```

### 2.2 Component Breakdown

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| MCP Client | Claude.ai / Claude Desktop / ChatGPT | Sends tool call requests; displays results to user |
| MCP Server | TypeScript + `@modelcontextprotocol/sdk` on Vercel | Exposes tools; routes calls to JobTread API |
| JobTread API Client | Custom TypeScript module | Constructs and executes Pave queries against JobTread |
| Auth Layer | API key header check (Vercel middleware) | Ensures only authorized clients can invoke tools |
| Secrets Store | Vercel Environment Variables | Stores `JOBTREAD_GRANT_KEY` and `MCP_API_KEY` securely |
| JobTread | `api.jobtread.com/pave` | Source of truth � all construction project data |

### 2.3 Transport Layer: Streamable HTTP

| Transport | How It Works | Vercel Compatible? | Use Case |
|-----------|-------------|-------------------|----------|
| stdio | Local process, stdin/stdout | No � local only | Single-user local dev |
| SSE | Long-lived HTTP stream | Problematic � 10s timeout | Avoid for Vercel |
| **Streamable HTTP** | **Stateless HTTP POST** | **Yes � perfect fit** | **THIS PROJECT ?** |

### 2.4 Why Vercel

- Zero server management � deploy from GitHub
- Free tier sufficient for internal team usage
- Built-in env var management for secrets
- Excellent TypeScript/Node.js support
- Custom domain support (e.g., `mcp.yourcompany.com`)
- 10�60 second function timeout
- Vercel CLI for local development that mirrors production

---

## 3. Technology Stack

### 3.1 Languages & Frameworks

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | 5.x | Primary language � type-safe, excellent MCP SDK support |
| Node.js | 20.x LTS | Runtime for Vercel serverless functions |
| Vercel | Latest | Hosting platform for serverless deployment |
| `@modelcontextprotocol/sdk` | Latest | Official MCP server SDK � tool registration, transport handling |
| zod | 3.x | Runtime schema validation for tool inputs |
| tsx / ts-node | Latest | Local TypeScript execution for development |

### 3.2 Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "@vercel/node": "latest"
  }
}
```

### 3.3 Development Tools

- **Vercel CLI** � run `vercel dev` locally to mirror production exactly
- **Claude Desktop** � connect to localhost to test tool calls in real conversations
- **JobTread Sandbox** � test against non-production data during development
- **VS Code** � TypeScript IntelliSense, Vercel extensions available
- **Postman or curl** � test the raw MCP HTTP endpoint directly
- **GitHub** � source control; Vercel auto-deploys on push to `main`

---

## 4. JobTread API Reference

### 4.1 Authentication (Grant Keys)

JobTread uses **Grant Keys** � long-lived API tokens generated under Settings ? Grant Management. The grant key is passed **inside the request body**, not as an HTTP header.

> ?? Grant keys expire after **3 months of inactivity**. Rotate every 2 months. See Section 10.4.

```typescript
const response = await fetch("https://api.jobtread.com/pave", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: {
      $: { grantKey: process.env.JOBTREAD_GRANT_KEY },
      // ... actual query here
    }
  })
});
```

### 4.2 Pave Query Language Overview

JobTread's API uses **Pave** � a proprietary query language similar to GraphQL. Single endpoint, all operations as POST requests with a JSON body.

**Reading data:**
```json
{
  "query": {
    "$": { "grantKey": "YOUR_GRANT_KEY" },
    "job": {
      "$": { "id": "job_abc123" },
      "id": {}, "name": {}, "status": {}, "startDate": {},
      "budget": { "totalCost": {}, "totalRevenue": {} }
    }
  }
}
```

**Writing data (mutation):**
```json
{
  "query": {
    "$": { "grantKey": "YOUR_GRANT_KEY" },
    "createAccount": {
      "$": { "name": "John Smith", "type": "customer", "organizationId": "org_xyz" },
      "createdAccount": { "id": {}, "name": {}, "createdAt": {} }
    }
  }
}
```

### 4.3 API Endpoint

```
POST https://api.jobtread.com/pave
```

### 4.4 Key Data Models

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| Organization | id, name | Your company � needed for scoping mutations |
| Job | id, name, status, startDate, endDate, customerId, locationId | Core entity � most tools interact with jobs |
| Account | id, name, type (customer/vendor), email, phone | Customers and vendors |
| Budget | id, jobId, lineItems, totalCost, totalRevenue | Financial data per job |
| BudgetItem | id, name, quantity, unitCost, costCode, catalogItemId | Individual line items |
| Document | id, jobId, type (estimate/invoice/PO), status, total | Generated documents |
| TimeEntry | id, jobId, userId, hours, date, description | Labor time logs |
| DailyLog | id, jobId, userId, date, notes | Project daily logs |
| Location | id, address, city, state, zip | Job site address |
| CatalogItem | id, name, unitCost, costCode | Pre-defined cost items |

---

## 5. MCP Tool Specifications

### 5.1 Tool Design Principles

- **Descriptions are critical** � Claude reads them to select the right tool. Be precise and unambiguous.
- **Fail gracefully** � every tool must return a structured error message if the API fails.
- **Return only what is needed** � extract and return only the fields Claude needs.
- **Validate inputs** � use Zod schemas before making any API call.
- **Use snake_case** for tool names (e.g., `get_job`, not `getJob`).
- **One tool, one responsibility** � no multi-purpose tools.

### 5.2 Jobs � 4 Tools

#### `search_jobs`
Search and filter jobs by name, status, customer, or date range.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Optional | Text search across job names and numbers |
| status | string | Optional | `open`, `closed`, `pending`, `in_progress` |
| customer_id | string | Optional | Filter by a specific customer account ID |
| limit | number | Optional | Max results (default: 20, max: 100) |

**Returns:** Array of jobs with id, name, number, status, customerName, startDate, totalBudget; total count.

---

#### `get_job`
Retrieve complete details for a single job by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | The JobTread job ID (e.g., `job_abc123`) |

**Returns:** Full job object with location, customer, budget summary, document count, task count.

---

#### `create_job`
Create a new job in JobTread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | **Required** | Name of the new job |
| customer_id | string | **Required** | ID of the customer account |
| start_date | string | Optional | YYYY-MM-DD |
| end_date | string | Optional | YYYY-MM-DD |
| location_address | string | Optional | Job site street address |
| notes | string | Optional | Initial notes or description |

**Returns:** Newly created job: id, name, number, status, createdAt.

---

#### `update_job_status`
Update the status of an existing job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | The JobTread job ID |
| status | string | **Required** | `open`, `closed`, `pending`, `in_progress` |

**Returns:** Updated job: id, name, status, updatedAt.

---

### 5.3 Budgets � 3 Tools

#### `get_budget`
Retrieve the full budget for a specific job including all line items.

| Parameter | Type | Required |
|-----------|------|----------|
| job_id | string | **Required** |

**Returns:** Budget summary (totalCost, totalRevenue, margin%) + line items array.

---

#### `add_budget_item`
Add a new line item to a job's budget.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | |
| name | string | **Required** | Name of the budget line item |
| quantity | number | **Required** | Quantity of units |
| unit_cost | number | **Required** | Cost per unit in dollars |
| cost_code | string | Optional | Cost code for categorization |
| cost_group | string | Optional | Cost group name for grouping |
| catalog_item_id | string | Optional | Pull pricing from existing catalog item |

**Returns:** Created budget item: id, name, quantity, unitCost, totalCost, costCode.

---

#### `get_budget_summary`
High-level financial summary for one or more jobs (totals only, no line items).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_ids | string[] | **Required** | Array of job IDs (up to 20) |

**Returns:** Per-job summary + aggregate totals.

---

### 5.4 Documents � 2 Tools

#### `create_document`
Generate a new document (estimate, invoice, PO, or bid request) for a job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | |
| type | string | **Required** | `estimate`, `invoice`, `purchase_order`, `bid_request` |
| title | string | Optional | Custom title (defaults to job name + type) |
| include_items | string[] | Optional | Specific budget item IDs to include (defaults to all) |

**Returns:** Created document: id, type, title, status (draft), total, createdAt, viewUrl.

---

#### `list_documents`
List all documents for a job, optionally filtered by type or status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | |
| type | string | Optional | `estimate`, `invoice`, `purchase_order`, `bid_request` |
| status | string | Optional | `draft`, `sent`, `approved`, `void` |

**Returns:** Array of documents: id, type, title, status, total, createdAt, sentAt.

---

### 5.5 Time & Daily Logs � 3 Tools

#### `log_time`
Create a time entry for a specific job and user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | |
| user_id | string | **Required** | The JobTread user ID for the worker |
| hours | number | **Required** | Number of hours worked |
| date | string | **Required** | YYYY-MM-DD |
| description | string | Optional | Description of work performed |

**Returns:** Created time entry: id, jobId, userId, hours, date, description, createdAt.

---

#### `get_time_entries`
Retrieve time entries filtered by job, user, or date range.

| Parameter | Type | Required |
|-----------|------|----------|
| job_id | string | Optional |
| user_id | string | Optional |
| start_date | string | Optional |
| end_date | string | Optional |

**Returns:** Array of time entries + total hours summarized by job and user.

---

#### `create_daily_log`
Create a daily log entry for a job (project diary, separate from time entries).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | string | **Required** | |
| date | string | **Required** | YYYY-MM-DD |
| notes | string | **Required** | Work performed, issues, weather, etc. |
| user_id | string | Optional | Defaults to grant owner |

**Returns:** Created log: id, jobId, date, notes, userId, createdAt.

---

### 5.6 Contacts & Accounts � 3 Tools

#### `search_accounts`
Search for customer or vendor accounts by name, email, or phone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | **Required** | Name, email, or phone to search |
| type | string | Optional | `customer`, `vendor` |
| limit | number | Optional | Max results (default: 10) |

**Returns:** Array of accounts: id, name, type, email, phone, jobCount.

---

#### `get_account`
Get full details for a single account by ID.

| Parameter | Type | Required |
|-----------|------|----------|
| account_id | string | **Required** |

**Returns:** Full account: id, name, type, email, phone, locations, openJobCount, totalJobValue.

---

#### `create_account`
Create a new customer or vendor account in JobTread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | **Required** | Full name or company name |
| type | string | **Required** | `customer` or `vendor` |
| email | string | Optional | |
| phone | string | Optional | |
| address | string | Optional | |
| city | string | Optional | |
| state | string | Optional | 2-letter code |
| zip | string | Optional | |

**Returns:** Created account: id, name, type, email, phone, createdAt.

---

## 6. Project Structure

### 6.1 Repository Layout

```
jobtread-mcp/
??? api/
?   ??? mcp.ts              # Vercel serverless entry point (MCP server)
??? lib/
?   ??? jobtread/
?   ?   ??? client.ts       # Core Pave API client (fetch wrapper)
?   ?   ??? jobs.ts         # Job-related API functions
?   ?   ??? budgets.ts      # Budget API functions
?   ?   ??? documents.ts    # Document API functions
?   ?   ??? time.ts         # Time entry API functions
?   ?   ??? accounts.ts     # Account/contact API functions
?   ??? tools/
?   ?   ??? jobs.ts         # MCP tool definitions for jobs
?   ?   ??? budgets.ts      # MCP tool definitions for budgets
?   ?   ??? documents.ts    # MCP tool definitions for documents
?   ?   ??? time.ts         # MCP tool definitions for time & logs
?   ?   ??? accounts.ts     # MCP tool definitions for contacts
?   ??? auth.ts             # API key validation middleware
?   ??? types.ts            # Shared TypeScript types
??? tests/
?   ??? jobs.test.ts
?   ??? budgets.test.ts
?   ??? tools.test.ts
??? .env.local              # Local secrets (NOT committed to git)
??? .env.example            # Template showing required env vars
??? .gitignore
??? tsconfig.json
??? vercel.json
??? package.json
```

### 6.2 File Descriptions

| File | Purpose |
|------|---------|
| `api/mcp.ts` | Single Vercel serverless function. Initializes MCP server, registers all tools, handles HTTP requests via Streamable HTTP transport. |
| `lib/jobtread/client.ts` | Thin wrapper around the JobTread Pave API. Handles authentication, error handling, and response parsing. |
| `lib/jobtread/*.ts` | One file per domain. Pure API functions with no MCP logic. |
| `lib/tools/*.ts` | One file per domain. Each exports an array of MCP tool definitions with name, description, Zod schema, and handler. |
| `lib/auth.ts` | Validates incoming `MCP_API_KEY` header on every request. Returns 401 if missing or invalid. |
| `lib/types.ts` | Shared TypeScript interfaces for JobTread entities. |
| `.env.local` | Local development secrets. Never committed to git. |
| `vercel.json` | Vercel configuration � function timeout, CORS headers, route configuration. |

---

## 7. Implementation Guide

### 7.1 Phase 1: Project Setup

- Create a new GitHub repository: `jobtread-mcp`
- Run `npm init -y` and install dependencies
- Configure `tsconfig.json` with `target: ES2020`, `module: NodeNext`
- Create `.env.local` with placeholder values; add to `.gitignore`
- Install Vercel CLI globally: `npm i -g vercel`
- Run `vercel login` and link to Vercel account
- Create directory structure per Section 6.1

### 7.2 Phase 2: JobTread API Client

```typescript
// lib/jobtread/client.ts
const JOBTREAD_API = 'https://api.jobtread.com/pave';

export async function paveQuery(query: object): Promise<any> {
  const grantKey = process.env.JOBTREAD_GRANT_KEY;
  if (!grantKey) throw new Error('JOBTREAD_GRANT_KEY not set');

  const body = { query: { $: { grantKey }, ...query } };
  const res = await fetch(JOBTREAD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`JobTread API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data;
}
```

### 7.3 Phase 3: MCP Server & Tools

```typescript
// api/mcp.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { jobTools } from '../lib/tools/jobs.js';
import { budgetTools } from '../lib/tools/budgets.js';
import { documentTools } from '../lib/tools/documents.js';
import { timeTools } from '../lib/tools/time.js';
import { accountTools } from '../lib/tools/accounts.js';
import { validateApiKey } from '../lib/auth.js';

export default async function handler(req: any, res: any) {
  if (!validateApiKey(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const server = new McpServer({ name: 'jobtread-mcp', version: '1.0.0' });
  const allTools = [...jobTools, ...budgetTools, ...documentTools, ...timeTools, ...accountTools];
  for (const tool of allTools) server.tool(tool);

  const transport = new StreamableHTTPServerTransport({ req, res });
  await server.connect(transport);
}
```

### 7.4 Phase 4: Auth & Security

```typescript
// lib/auth.ts
export function validateApiKey(req: any): boolean {
  const key = req.headers['x-api-key'];
  return key === process.env.MCP_API_KEY;
}
```

> ?? Never hardcode API keys or grant keys. Always use `process.env`.

### 7.5 Phase 5: Local Testing

```bash
vercel dev
# Server runs at http://localhost:3000/api/mcp
```

**Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "jobtread": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "x-api-key": "your-local-test-key" }
    }
  }
}
```

### 7.6 Phase 6: Vercel Deployment

1. Push code to GitHub `main` branch
2. In Vercel dashboard, create a new project linked to the GitHub repo
3. Add environment variables: `JOBTREAD_GRANT_KEY` and `MCP_API_KEY`
4. Deploy � Vercel auto-builds from the GitHub push
5. Test the live endpoint with curl
6. Update team's Claude Desktop/Claude.ai config with the production URL
7. Optionally add a custom domain in Vercel settings

---

## 8. Security & Authentication

### 8.1 JobTread Grant Key Management

- Generate in JobTread under Settings ? Grant Management (shown **once**)
- Store immediately in Vercel's environment variable dashboard
- **Never** commit to git, Slack, email, or any chat tool
- Grant keys expire after **3 months of inactivity** � rotate every 2 months
- If compromised: revoke immediately, generate a new one, update Vercel, redeploy

### 8.2 Endpoint Protection Options

| Method | How It Works | Best For |
|--------|-------------|----------|
| **Shared API Key (Recommended)** | All team members include `x-api-key: YOUR_KEY` in their Claude config | Small teams � simple, zero extra setup |
| Vercel Password Protection | Vercel's built-in feature (Pro plan) adds HTTP basic auth | Non-technical team members |
| Per-User Grant Keys | Each user has their own JobTread grant key in their Claude config | Maximum auditability |

### 8.3 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JOBTREAD_GRANT_KEY` | Company's JobTread API grant key. Required for all API calls. | `gt_abc123xyz...` |
| `MCP_API_KEY` | Shared secret your team puts in their Claude config. | `mcp_secret_abc123` |
| `JOBTREAD_ORG_ID` | Your JobTread organization ID. Used to scope mutations. | `org_xyz789` |
| `NODE_ENV` | Set to `production` automatically by Vercel. | `production` |

---

## 9. Testing Strategy

### 9.1 Local Testing with Claude Desktop

Use the JobTread sandbox environment during development. Suggested test prompts:

| Tool | Test Prompt |
|------|------------|
| `search_jobs` | Show me all open jobs |
| `get_job` | Give me full details on job #1001 |
| `create_job` | Create a test job called MCP Test Job for customer ID cust_123 |
| `get_budget` | Show me the budget for job #1001 |
| `add_budget_item` | Add 10 hours of labor at $75/hr to job #1001 |
| `create_document` | Create an estimate for job #1001 |
| `log_time` | Log 4 hours for user usr_123 on job #1001 for today |
| `search_accounts` | Find the account for Test Customer |
| `create_account` | Add a new test customer called Test Co with email test@test.com |

### 9.2 Unit Testing Tools

Write unit tests for `lib/jobtread/*.ts` using mocked fetch responses (e.g., with `vitest`).

### 9.3 Integration Testing

Before deploying to production:
- Create a sandbox grant key in your JobTread sandbox account
- Run `vercel dev` with sandbox credentials in `.env.local`
- Execute each test prompt from Section 9.1 in Claude Desktop
- Test edge cases: invalid job IDs, missing required fields, empty search results

---

## 10. Deployment & Operations

### 10.1 Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "api/mcp.ts": { "maxDuration": 30 }
  },
  "headers": [
    {
      "source": "/api/mcp",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, x-api-key" }
      ]
    }
  ]
}
```

### 10.2 Connecting Claude to the Production Server

**Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "jobtread": {
      "url": "https://your-project.vercel.app/api/mcp",
      "headers": { "x-api-key": "YOUR_MCP_API_KEY" }
    }
  }
}
```

**Claude.ai (web app):** Settings ? Integrations ? Add MCP Server ? Enter URL + add `x-api-key` header.

### 10.3 Monitoring & Logs

- **Vercel dashboard** � view function invocation logs, errors, and execution times
- **Structured logging** � `console.log` in tool handlers with job IDs and tool names
- **Error alerting** � Vercel can integrate with Slack or email for function error alerts
- **Usage tracking** � log which tools are called most to prioritize enhancements

### 10.4 Grant Key Rotation

> Set a recurring calendar reminder to rotate every **2 months**.

1. Log into JobTread ? Settings ? Grant Management
2. Create a new grant key � copy it immediately (shown once)
3. Vercel dashboard ? Project Settings ? Environment Variables
4. Update `JOBTREAD_GRANT_KEY` with the new value
5. Click **Redeploy** in Vercel (no code change needed)
6. Verify the server works by running a test query in Claude
7. Revoke the old grant key in JobTread

---

## 11. Build Phases & Timeline

### 11.1 Phase Breakdown

| Phase | Description | Deliverable |
|-------|-------------|-------------|
| **Phase 1 � Setup** | GitHub repo, Vercel project, TypeScript config, directory structure, env vars | Working skeleton deployed to Vercel with no tools yet |
| **Phase 2 � API Client** | Build `lib/jobtread/` modules. Test each function against JobTread sandbox. | All JobTread API functions working and tested |
| **Phase 3 � Core Tools** | Build tools for jobs and budgets (7 tools). Connect to Claude Desktop locally. | Claude can search jobs, view budgets, add budget items |
| **Phase 4 � Remaining Tools** | Build document, time, and account tools (8 more tools). Full local test suite. | All 15 tools working locally |
| **Phase 5 � Auth & Security** | Add API key middleware. Final security review. Env var audit. | Endpoint protected and production-ready |
| **Phase 6 � Deploy & Connect** | Deploy to Vercel. Connect team members. Monitor first real usage. | Live server, entire team connected |

### 11.2 Effort Estimates

| Phase | Estimated Hours | Notes |
|-------|----------------|-------|
| Phase 1 � Setup | 4�6 hours | Mostly config and tooling |
| Phase 2 � API Client | 8�12 hours | Includes exploring JobTread API docs and sandbox testing |
| Phase 3 � Core Tools (7) | 8�12 hours | Jobs + budgets � the heaviest logic |
| Phase 4 � Remaining Tools (8) | 8�10 hours | Follows same pattern established in Phase 3 |
| Phase 5 � Auth & Security | 3�4 hours | Straightforward with the pattern in Section 8 |
| Phase 6 � Deploy & Connect | 2�4 hours | Vercel deploy + team onboarding |
| Buffer / Testing / Debugging | 8�10 hours | Always budget for unexpected API quirks |
| **Total** | **41�58 hours** | **~1�1.5 weeks for a single focused developer** |

> A competent developer can have a working local prototype (all 15 tools) in 3�4 days, and the production Vercel deployment ready within 2 weeks including testing.

---

## 12. Appendix

### 12.1 Full Tool Schema Reference

| Tool Name | Required Inputs | Returns |
|-----------|----------------|---------|
| `search_jobs` | none (all optional) | Array of job summaries |
| `get_job` | job_id | Full job object |
| `create_job` | name, customer_id | Created job |
| `update_job_status` | job_id, status | Updated job |
| `get_budget` | job_id | Budget with line items |
| `add_budget_item` | job_id, name, quantity, unit_cost | Created item |
| `get_budget_summary` | job_ids[] | Financial totals per job |
| `create_document` | job_id, type | Created document with URL |
| `list_documents` | job_id | Array of documents |
| `log_time` | job_id, user_id, hours, date | Created time entry |
| `get_time_entries` | none (all optional) | Array of time entries + totals |
| `create_daily_log` | job_id, date, notes | Created log entry |
| `search_accounts` | query | Array of account summaries |
| `get_account` | account_id | Full account object |
| `create_account` | name, type | Created account |

### 12.2 Example Pave Queries

**List all open jobs with budget totals:**
```json
{
  "query": {
    "$": { "grantKey": "YOUR_KEY" },
    "organization": {
      "$": { "id": "YOUR_ORG_ID" },
      "jobs": {
        "$": { "filters": [{ "status": { "eq": "open" } }] },
        "nodes": {
          "id": {}, "name": {}, "number": {}, "status": {},
          "budget": { "totalCost": {}, "totalRevenue": {} }
        }
      }
    }
  }
}
```

**Get full job details including customer and location:**
```json
{
  "query": {
    "$": { "grantKey": "YOUR_KEY" },
    "job": {
      "$": { "id": "job_abc123" },
      "id": {}, "name": {}, "status": {}, "startDate": {}, "endDate": {},
      "account": { "id": {}, "name": {}, "email": {}, "phone": {} },
      "location": { "address": {}, "city": {}, "state": {}, "zip": {} },
      "budget": { "totalCost": {}, "totalRevenue": {} }
    }
  }
}
```

### 12.3 Claude Desktop Config Example (Production)

```json
{
  "mcpServers": {
    "jobtread": {
      "url": "https://jobtread-mcp.vercel.app/api/mcp",
      "headers": {
        "x-api-key": "mcp_yourcompanykey_abc123"
      },
      "description": "Company JobTread data � jobs, budgets, documents, time, contacts"
    }
  }
}
```

**Config file locations:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

---

*End of Specification � JobTread MCP Server v1.0*
