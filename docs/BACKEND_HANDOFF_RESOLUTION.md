# Frontend handoff resolution

Validated against the local API on 2026-09-06. Frontend base URL:

```text
http://localhost:3000/api
```

Interactive Swagger is at `http://localhost:3000/api/docs`; the machine-readable
OpenAPI document is at `http://localhost:3000/api/openapi.json`.

## Resolved blockers

| Original issue                                 | Backend contract now                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member/admin responses exposed password hashes | User fields use an explicit safe serializer and model-level fallback. Stored `passwordHash` values and invitation token hashes are never serialized. The raw refresh token returned by login/refresh remains intentional authentication output and is never stored in plaintext. |
| `POST /ai/chat` returned generic 500           | The schema mismatch on non-paranoid agent tables is fixed. A valid configured request completes; missing configuration returns `503 AI_PROVIDER_NOT_CONFIGURED`, and provider failure returns `502 AI_PROVIDER_ERROR`.                                                           |
| Empty audit logs returned 500                  | `GET /admin/audit-logs?page=1&limit=20` returns `200` and `{ items: [], pagination: { page, limit, total, totalPages } }`.                                                                                                                                                       |
| Swagger URL unknown                            | Use `/api/docs` or `/api/openapi.json`.                                                                                                                                                                                                                                          |
| No role lookup                                 | Use `GET /organization/roles`; send the selected numeric `id` as `roleId`.                                                                                                                                                                                                       |
| No pipeline/stage lookup                       | Use `GET /crm/pipelines`; its default Sales pipeline has Lead, Qualified, Proposal, Negotiation, Won, and Lost.                                                                                                                                                                  |
| QA identity was disposable                     | `npm run qa:reset` recreates only the configured QA tenant and prints its generated IDs.                                                                                                                                                                                         |
| Report format unclear                          | Markdown, HTML, and PDF downloads contain the requested real format. PDF is binary, not renamed Markdown.                                                                                                                                                                        |

Regression coverage protects the member/admin serializers, empty audit
pagination, credential encryption, report rendering, agent routing, action
policy, and orchestration guardrails.

## Frontend discovery calls

Run these after login and cache them per organization:

```http
GET /organization/roles
GET /crm/pipelines
GET /ai/assistants
GET /projects
```

Do not hard-code role, stage, or project IDs. They are database-generated and
may change after a QA reset.

## Chat errors

The frontend can display the returned `message` and offer Retry for both
provider conditions:

```json
{
  "success": false,
  "message": "AI service is not configured",
  "code": "AI_PROVIDER_NOT_CONFIGURED",
  "errors": []
}
```

```json
{
  "success": false,
  "message": "AI provider is temporarily unavailable. Please try again.",
  "code": "AI_PROVIDER_ERROR",
  "errors": []
}
```

The first response is HTTP 503 and the second is HTTP 502. Provider exception
details, credentials, and stack traces are not sent to clients.

## QA setup

Local defaults:

```text
email: codex.qa@example.com
password: QaPassword123!
```

Recreate the QA tenant before a deterministic integration run:

```bash
npm run qa:reset
```

The script refuses to run in production. Credentials can be overridden with
`QA_EMAIL` and `QA_PASSWORD`. Fetch the current project through `GET /projects`.

## Deployment configuration

Required production secrets and services:

- `OPENAI_API_KEY` plus optional per-assistant model variables.
- `INTEGRATION_ENCRYPTION_KEY`, set to a long random production secret.
- `EMAIL_API_URL`, `EMAIL_API_KEY`, and `EMAIL_FROM` for invitation and password
  reset delivery.
- PostgreSQL migrations must run with `DB_SYNC=false`.

Automation runs still use the existing synchronous placeholder. Connecting a
durable production queue/worker remains an infrastructure dependency; the API
handoff does not claim that it is already durable.

## Verification evidence

The final local smoke pass confirmed:

- CEO suggest-mode chat returned HTTP 201 with an answer.
- Empty audit logs returned HTTP 200 and zero-item pagination.
- Member and admin-user JSON contained no password or token hash keys.
- Role discovery returned Admin, Member, and Owner.
- Pipeline discovery returned all six default stages, including Negotiation.
- Swagger JSON loaded successfully.
- PDF download returned `application/pdf` with a `%PDF-` signature; HTML returned
  a complete `text/html` document.

See [FE AI agent integration](./FE_AI_AGENT_INTEGRATION.md) for reusable chat UI
contracts and [P1 API payloads](./FE_P1_API_PAYLOADS.md) for the remaining
modules.
