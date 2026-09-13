# AKEEM Customer MVP — Frontend Integration

Backend base URL: `${VITE_API_URL}` (local default `http://localhost:3000/api`). All JSON responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "message": string, "code": string, "errors": string[] }`. Send `Authorization: Bearer <accessToken>` except on invitation inspection/acceptance and health routes.

## 1. Project chat and agent delegation

Use one chat component everywhere and change only `assistant` and page context:

```http
POST /ai/chat
Content-Type: application/json

{
  "projectId": 4,
  "assistant": "ceo",
  "message": "Analyze current delivery and financial risks, then recommend the top three actions.",
  "executionMode": "suggest",
  "context": {
    "module": "projects",
    "page": "project-detail",
    "entityType": "project",
    "entityId": 4,
    "selection": {}
  }
}
```

Available assistants come from `GET /ai/assistants`. Supported keys currently include `ceo`, `executive`, `sales`, `finance`, `marketing`, `legal`, `operations`, and `customer-success`. Use `suggest` for previews and `auto` only after the user explicitly enables execution.

```json
{
  "success": true,
  "data": {
    "conversationId": 50,
    "messageId": 79,
    "projectId": 4,
    "assistant": "ceo",
    "answer": "...",
    "routing": { "delegated": true, "specialists": ["operations", "finance"] },
    "delegations": [],
    "actions": [],
    "citations": [
      { "fileId": 12, "filename": "budget.pdf", "reference": "page 3" }
    ],
    "usage": { "inputTokens": 1200, "outputTokens": 420 },
    "createdAt": "2026-09-08T12:00:00.000Z"
  }
}
```

Conversation UI:

- List: `GET /ai/conversations?projectId=4&assistant=ceo&page=1&limit=20`
- History: `GET /ai/conversations/:id/messages`
- Delete: `DELETE /ai/conversations/:id`
- Delegations: `GET /ai/delegations?projectId=4&conversationId=50&page=1&limit=20`
- Delegation detail: `GET /ai/delegations/:id`

Stable delegation fields are `id`, `conversationId`, `projectId`, `assistant`, `objective`, `status`, `answer`, `model`, `usage`, `actions`, `error`, `attemptCount`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`, `fromAgent`, and `toAgent`.

Persisted assistant messages expose `toolCalls` as:

```ts
type ToolCall = {
  delegationId: number | null;
  assistant: string;
  objective: string;
  status: string;
  actions: Array<{
    type: string;
    status: 'completed' | 'suggested' | 'failed';
    reason?: string;
    resource?: { type: string; id: number };
  }>;
};
```

Message `metadata` contains `requestedAssistant`, `executionMode`, `delegated`, `delegationIds`, and `citations`. Render citations under the answer and open `/files/:fileId/download` when clicked.

## 2. Documents and knowledge

Upload with `multipart/form-data`:

```http
POST /files/upload

file=<binary>
projectId=4
```

Accepted types: PDF, DOCX, XLSX, CSV, TXT, Markdown, JSON, PNG, JPEG, WEBP, GIF, BMP, and TIFF. The server verifies file signatures/MIME, sanitizes filenames, optionally calls the malware scanner, performs OCR when needed, and indexes tenant/project-scoped chunks.

The upload response preserves the file fields and adds:

```json
{
  "id": 12,
  "originalName": "budget.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 24018,
  "projectId": 4,
  "processingStatus": "pending",
  "processingError": null,
  "scanStatus": "clean",
  "processedAt": null
}
```

Poll `GET /files/:id` every 2 seconds while status is `pending` or `processing`; stop on `ready` or `failed`. Show the safe `processingError` on failure and offer `POST /files/:id/process`. Download through authenticated `GET /files/:id/download`; use a blob response and the server's `Content-Disposition` filename. Never expect or store a `storageKey` or filesystem path. `DELETE /files/:id` also removes its knowledge chunks.

## 3. Invitations

Invitation landing page reads the URL token and calls:

```http
GET /organization/invitations/accept?token=<token>
```

Response tells the UI whether `existingUser` is true and returns safe organization/role details. For a new account:

```http
POST /organization/invitations/accept

{
  "token": "...",
  "email": "member@example.com",
  "firstName": "A",
  "lastName": "User",
  "password": "minimum-8-characters"
}
```

For an already signed-in user call `POST /organization/invitations/accept-authenticated` with bearer token and `{ "token": "..." }`. A signed-out existing user may call the normal accept route with account password. On success navigate to `data.redirectTo`. Treat `INVITATION_INVALID`, `INVITATION_EXPIRED`, `INVITATION_NOT_ACTIVE`, `INVITATION_PROFILE_REQUIRED`, and `INVITATION_AUTH_REQUIRED` as separate UI states.

Organization admins use:

- `POST /organization/invitations` with `{ email, roleId }`
- `POST /organization/invitations/:id/resend`
- `DELETE /organization/invitations/:id`

Display `emailDelivered` exactly as returned; `false` means the invitation exists but delivery failed.

## 4. Approvals

Create with `POST /approvals`. Review with `POST /approvals/:id/approve` or `/reject`, body `{ "comment": "..." }`. Only an active Owner, Admin, or configured Approver can review; Members and the original requester receive HTTP 403. Handle `FORBIDDEN` without optimistic UI success.

## 5. Finance scoping

Append `projectId` to all project finance screens:

- `/finance/overview?projectId=4&period=month`
- `/finance/transactions?projectId=4&page=1&limit=20`
- `/finance/invoices?projectId=4&page=1&limit=20`
- `/finance/budgets?projectId=4`
- `/finance/cash-flow?projectId=4&period=month`
- `/finance/reports?projectId=4&period=month`

Omit `projectId` only for organization-wide screens. A foreign/deleted project returns `PROJECT_NOT_FOUND`.

## 6. Durable automations

```http
POST /automations

{
  "name": "Weekly delivery report",
  "projectId": 4,
  "trigger": { "cron": "0 9 * * 1", "timezone": "Europe/Berlin" },
  "actions": [
    { "type": "create_report", "payload": { "title": "Weekly delivery", "assistant": "executive" } }
  ],
  "enabled": true,
  "retryLimit": 3,
  "timeoutSeconds": 60
}
```

Supported actions: `create_task`, `create_report`/`generate_report`, `create_approval`, `create_budget`, and `create_crm_activity`. Manual execution is `POST /automations/:id/run` with `{ "idempotencyKey": "ui:<automationId>:<unique-event-id>" }`. Reusing the same key returns the same run rather than duplicating work.

Poll `GET /automations/:id/runs`. States are `queued`, `running`, `completed`, and `failed`. Render `attemptCount/maxAttempts`, `startedAt`, `finishedAt`, `actionResults`, and `failureReason`. Retry a terminal failure with `POST /automations/:id/runs/:runId/retry`.

## 7. AI tasks

`POST /ai/tasks` requires an integer `projectId`. Completed `output` always contains `conversationId`, `messageId`, `answer`, `routing`, `delegations`, `actions`, and `usage`. Do not assume organization-wide AI tasks.

## 8. Operational endpoints and error handling

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready` (database, storage, AI, automation worker)
- Swagger: `/docs`
- OpenAPI JSON: `/openapi.json`

Handle HTTP 413 as `FILE_TOO_LARGE`, 415 as a file type/signature error, 429 as `RATE_LIMIT_EXCEEDED`, 502 as `AI_PROVIDER_ERROR`, and 503 as provider/readiness unavailable. On 401, perform the existing refresh-token flow once, retry the original request once, then sign out.

## Exact frontend implementation order

1. Point `VITE_API_URL` to the backend `/api` root and keep the existing bearer/refresh interceptor.
2. Replace page-specific chat calls with `/ai/chat`, always sending the selected `projectId`, assistant key, `executionMode`, and page context.
3. Render `routing`, delegation/action states, and document citations from the chat response; never infer successful execution from answer text.
4. Add document status polling and authenticated blob download; remove any direct storage URL handling.
5. Add invitation inspect, new-user accept, authenticated-user accept, resend, and revoke states.
6. Pass `projectId` through every finance query listed above.
7. Treat automation run creation as asynchronous: show queued immediately, poll run history, and render retry/failure state.
8. Use backend `code` values for user-facing error mapping and verify final contracts against `/api/openapi.json`.
