# NexusFlow OS API

NestJS and PostgreSQL backend for a multi-tenant AI business operating system. It includes authentication, projects, work management, CRM, Finance, approvals, automations, files, reports, notifications, administration, and a multi-agent chat runtime.

The CEO chat can inspect organization/project data, delegate work to Finance, Sales, Marketing, Legal, Operations, Customer Success, or Executive specialists, run safe in-app actions, and return one consolidated result. Every delegation, model call, created resource, and token count is persisted for visibility.

## Requirements

- Node.js 20+
- PostgreSQL
- An OpenAI API key for chat and AI-task execution

## Setup

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run start:dev
```

Set the database, JWT, frontend origin, and OpenAI values in `.env`. Both the
Nest runtime and Sequelize CLI read `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD`, and `DB_NAME` from that file; there are no fallback database
credentials. `DB_SYNC` should remain `false` outside disposable local
development databases. Set `DB_SSL=true` when the database provider requires
TLS.

The API listens on `http://localhost:3000` by default. Swagger UI is available at `http://localhost:3000/api/docs`; its OpenAPI JSON is published at `http://localhost:3000/api/openapi.json`.

## Commands

```bash
npm run build
npm test -- --runInBand
npm run test:e2e
npm run db:migrate
npm run db:migrate:undo
npm run qa:reset
```

## AI runtime

Use `POST /api/ai/chat` for a contextual chat widget on any application page. Use `POST /api/ai/:assistant/chat` for direct department chat. `projectId` is optional for chat, so assistants can work in either a project or organization-wide context.

The action runtime exposes only reversible or reviewable application actions: task creation, draft invoices, budgets, reports, approval requests, and CRM activities. It does not give models access to destructive operations, payment execution, invoice sending, credentials, or arbitrary code.

See [Frontend handoff resolution](docs/BACKEND_HANDOFF_RESOLUTION.md) for the
verified fixes, discovery endpoints, report behavior, and QA setup. See
[Frontend AI-agent integration](docs/FE_AI_AGENT_INTEGRATION.md) for TypeScript
contracts and UI integration. See [Multi-agent chat and autonomous
execution](docs/AI_ORCHESTRATION.md) for model overrides, delegation behavior,
and the action safety policy. See [P1 API
payloads](docs/FE_P1_API_PAYLOADS.md) for the rest of the backend.

## Main modules

- Auth and tenant isolation
- Projects, tasks, and dashboard summaries
- CRM companies, contacts, deals, and activities
- Finance transactions, invoices, budgets, cash flow, and reports
- AI agent directory, teams, conversations, messages, tasks, and delegations
- Approvals, notifications, automations, files, reports, settings, and admin audit data
