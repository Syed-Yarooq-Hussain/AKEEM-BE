# Agent team integration — 2026-09-09

The Command Center and global chat drawer use the same backend workflow. CEO and Executive route to specialists; any specialist can request necessary help from another specialist and finish its response using that result.

- Maximum eight agent executions per request, two child assignments per specialist, and three agents along a path. Ancestors cannot be called again.
- Child results are returned to the assigning agent before its final actions run. `suggest` mode propagates to every child and does not execute business actions.
- Delegations persist `parentDelegationId`, the assigning/receiving agent, status, result, actions, and usage. A failed final synthesis preserves completed specialist results.
- FE prepares a conversation with `POST /api/ai/conversations`, then posts to `/api/ai/chat`. It polls conversation-scoped delegations while awaiting the answer. Running records are shown as running, and history restores handoff links.
- The chat timeout defaults to 600 seconds (`AI_CHAT_TIMEOUT_MS`); other requests retain `REQUEST_TIMEOUT_MS`. Chat execution is request-based, not a durable background job; process restarts can interrupt it.

## Verification

- Backend build, frontend TypeScript check, and frontend production build pass.
- All four existing PostgreSQL migrations are applied.
- Local login and health endpoints respond successfully.
- Dashboard (organization and project), projects, assistant directory, saved chat history, delegations, approvals, automations, CRM, Finance, files, reports, members, and audit-log endpoints respond successfully in the local QA tenant.
- Dashboard optional project filtering is fixed, chart buckets use invoice/expense records, and AI activity is scoped to the current organization/project.
- CRM updates preserve record/tenant IDs and validate linked organization records; invoice updates use an editable-field allowlist; project date updates validate against retained dates.
- Real provider call in QA conversation 51 completed Sales → Finance → Sales; delegation 7 references parent 6. The response includes both agents and aggregated usage; no business actions were requested.
- No new unit tests were written or run for this change.

## Follow-up verification — 2026-09-11

- Fixed provider timeout timer cleanup on success and failure.
- When every specialist fails, chat now returns HTTP 502 `AI_PROVIDER_ERROR` instead of a successful envelope containing only an unavailable message. Failed delegation records remain available for inspection; partial results retain the existing behavior.
- Added regression coverage for timeout cleanup, permanent provider errors, nested delegation result ordering and suggest-mode propagation, and all-specialist failure handling.
- Final checks: 19 unit suites / 47 tests passed; the existing authentication e2e test passed; backend build and focused ESLint passed; frontend TypeScript check passed. All four migrations are applied.
- Real provider smoke checks passed for all eight assistants using the configured `gpt-4.1-mini` model (returned version `gpt-4.1-mini-2025-04-14`). QA conversations 53–60 cover nested Sales → Finance → Executive collaboration and direct answers from the other assistants. These were suggest-mode requests with no business actions executed.
- After restarting the final backend build on port 3000, readiness passed and Finance conversation 61 completed successfully.
- No frontend files changed in this follow-up. Its existing API error handling supports the 502 response; no new response fields are required.
- These are local integration checks against a sparse QA project, not production deployment or comprehensive answer-quality evaluation. The initial sandboxed provider check failed; the same request succeeded with network access.

## Run locally

Backend: `npm run build` then `npm run start:prod` (entry point `dist/src/main.js`). Development: `npm run start:dev`.

Frontend in `D:/KI-app/KI-Agentic-FE`: `npm run dev`; API defaults to `http://localhost:3000/api`. Production frontend build: `npm run build`.

Deployment still requires the environment's database, AI provider, email configuration, persistent file storage, and an external production hosting setup. Local build and API verification do not verify a deployed environment.
