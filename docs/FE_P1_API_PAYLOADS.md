# AKEEM P1 API Payload Reference

Base URL: `http://localhost:3000/api`

Protected endpoints require:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Successful responses use:

```json
{ "success": true, "data": {} }
```

Errors use:

```json
{
  "success": false,
  "message": "Human-readable error",
  "code": "ERROR_CODE",
  "errors": []
}
```

IDs are numbers and dates are ISO 8601 strings. Fields not being updated may be omitted from PATCH requests.

## AI chat and delegation

Frontend implementation details, TypeScript contracts, API client examples, UI state, query invalidation, and acceptance criteria are documented in [FE_AI_AGENT_INTEGRATION.md](./FE_AI_AGENT_INTEGRATION.md).

Backend orchestration behavior and its safety policy are documented in [AI_ORCHESTRATION.md](./AI_ORCHESTRATION.md).

## Approvals

### Create approval

`POST /approvals`

Required: `title`, `type`. The authenticated user becomes `requestedBy`.

```json
{
  "projectId": 1,
  "title": "Approve Orbit contract",
  "type": "contract",
  "amount": 680000,
  "currency": "PKR",
  "description": "Final commercial terms require approval",
  "metadata": {
    "contractId": 44
  }
}
```

### Approve or reject

```http
POST /approvals/1/approve
POST /approvals/1/reject
```

```json
{
  "comment": "Approved after reviewing the financial impact"
}
```

Valid approval statuses returned by the API: `pending`, `approved`, `rejected`.

## Automations

### Create automation

`POST /automations`

Required: `name`, `trigger`.

```json
{
  "projectId": 1,
  "name": "Weekly project report",
  "description": "Generate an executive report each Monday",
  "trigger": {
    "type": "schedule",
    "cron": "0 9 * * 1"
  },
  "actions": [
    {
      "type": "generate_report",
      "assistant": "executive"
    }
  ],
  "enabled": true,
  "nextRunAt": "2026-09-08T09:00:00.000Z"
}
```

### Update automation

`PATCH /automations/1`

Send only changed fields:

```json
{
  "name": "Daily executive report",
  "trigger": {
    "type": "schedule",
    "cron": "0 9 * * *"
  },
  "enabled": false
}
```

Manual run:

```http
POST /automations/1/run
```

No request body is required.

## CRM companies

### Create company

`POST /crm/companies`

```json
{
  "name": "Orbit Technologies",
  "domain": "orbit.example",
  "industry": "Technology",
  "phone": "+92-300-1234567",
  "website": "https://orbit.example",
  "address": {
    "line1": "Main Boulevard",
    "city": "Lahore",
    "country": "PK"
  },
  "tags": ["enterprise", "priority"],
  "customFields": {
    "employeeCount": 120
  }
}
```

Update with `PATCH /crm/companies/:id`. The same fields are accepted and all are optional during an update.

## CRM contacts

### Create contact

`POST /crm/contacts`

```json
{
  "companyId": 1,
  "firstName": "Sara",
  "lastName": "Ahmed",
  "email": "sara@orbit.example",
  "phone": "+92-300-7654321",
  "jobTitle": "Operations Director",
  "lifecycleStage": "lead",
  "tags": ["decision-maker"],
  "customFields": {}
}
```

`ownerId` is optional. When omitted, the logged-in user becomes owner.

Update with `PATCH /crm/contacts/:id`.

## CRM deals

### Discover pipelines and stages

`GET /crm/pipelines`

The endpoint returns the organization's pipelines with ordered `stages`. A new
organization receives a `Sales` pipeline with `Lead`, `Qualified`, `Proposal`,
`Negotiation`, `Won`, and `Lost`. Use the returned numeric stage `id` when
possible; stage names remain supported for convenience.

### Create deal

`POST /crm/deals`

```json
{
  "name": "Orbit Enterprise Contract",
  "companyId": 1,
  "contactId": 1,
  "value": 680000,
  "currency": "PKR",
  "ownerId": 1,
  "expectedCloseDate": "2026-09-10"
}
```

`name` is stored internally as the deal title. If no pipeline exists, the API creates a default `Sales` pipeline and `Lead` stage.

Update with `PATCH /crm/deals/:id`:

```json
{
  "name": "Orbit Revised Contract",
  "value": 720000,
  "expectedCloseDate": "2026-09-15",
  "status": "open"
}
```

Change stage with `PATCH /crm/deals/:id/stage` using either stage ID or stage name:

```json
{
  "stageId": 3,
  "status": "open"
}
```

```json
{
  "stage": "Negotiation",
  "status": "open"
}
```

Common deal statuses: `open`, `won`, `lost`.

## Finance transactions

### Create transaction

`POST /finance/transactions`

Required: `type`, `amount`.

```json
{
  "projectId": 1,
  "accountId": 1,
  "categoryId": 2,
  "companyId": 1,
  "type": "income",
  "amount": 250000,
  "currency": "PKR",
  "transactionDate": "2026-09-02T10:00:00.000Z",
  "description": "Orbit milestone payment",
  "reference": "BANK-REF-1001",
  "status": "cleared",
  "metadata": {}
}
```

If `accountId` is omitted, the API creates or uses a `Primary Cash` account.

Common types: `income`, `expense`, `transfer`. Common statuses: `pending`, `cleared`, `cancelled`.

## Finance invoices

### Create invoice

`POST /finance/invoices`

```json
{
  "projectId": 1,
  "companyId": 1,
  "contactId": 1,
  "invoiceNumber": "INV-2026-001",
  "status": "draft",
  "issueDate": "2026-09-02",
  "dueDate": "2026-09-16",
  "currency": "PKR",
  "discountTotal": 5000,
  "notes": "Payment due within 14 days",
  "items": [
    {
      "description": "Discovery and project setup",
      "quantity": 1,
      "unitPrice": 100000,
      "taxRate": 0.16
    },
    {
      "description": "Platform implementation",
      "quantity": 2,
      "unitPrice": 75000,
      "taxRate": 0.16
    }
  ]
}
```

`invoiceNumber` is optional; the backend generates one when omitted. Totals are calculated by the backend.

### Update invoice

`PATCH /finance/invoices/:id`

```json
{
  "status": "sent",
  "dueDate": "2026-09-20",
  "notes": "Updated payment deadline",
  "sentAt": "2026-09-03T09:00:00.000Z"
}
```

Common invoice statuses: `draft`, `sent`, `partially_paid`, `paid`, `overdue`, `cancelled`.

## Finance budgets

### Create budget

`POST /finance/budgets`

Required: `name`, `amount`.

```json
{
  "projectId": 1,
  "categoryId": 2,
  "name": "September marketing budget",
  "amount": 300000,
  "currency": "PKR",
  "periodStart": "2026-09-01",
  "periodEnd": "2026-09-30",
  "metadata": {}
}
```

## File upload

`POST /files/upload`

Content type must be `multipart/form-data`.

| Field       | Type        | Required | Notes                              |
| ----------- | ----------- | -------: | ---------------------------------- |
| `file`      | File        |      Yes | Maximum 10 MB                      |
| `projectId` | Number/text |       No | Associates the file with a project |

cURL:

```bash
curl --location 'http://localhost:3000/api/files/upload' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --form 'file=@"C:/files/contract.pdf"' \
  --form 'projectId="1"'
```

Accepted MIME types are currently not restricted. Frontend should still validate expected file types.

## Reports

### Generate report

`POST /reports/generate`

```json
{
  "projectId": 1,
  "title": "September Executive Report",
  "assistant": "ceo",
  "format": "markdown",
  "content": "Optional pre-generated report content",
  "metadata": {
    "period": "2026-09"
  }
}
```

Valid assistants: `ceo`, `executive`, `sales`, `finance`, `marketing`, `legal`, `operations`, `customer-success`.

If `content` is omitted, the backend creates a basic report template. Download using `GET /reports/:id/download`.

`format` must be `markdown`, `html`, or `pdf`. The backend keeps canonical
Markdown content and renders the selected format at download time:

| Format     | Download content type          | File contents                  |
| ---------- | ------------------------------ | ------------------------------ |
| `markdown` | `text/markdown; charset=utf-8` | UTF-8 Markdown                 |
| `html`     | `text/html; charset=utf-8`     | Complete escaped HTML document |
| `pdf`      | `application/pdf`              | Binary PDF (`%PDF-` signature) |

## Organization settings

### Discover roles

`GET /organization/roles`

Returns the supported organization roles as `{ id, name, description,
isSystem }[]`. Load this directory for invitation and member-role controls;
never hard-code numeric role IDs. `Owner`, `Admin`, and `Member` are guaranteed
for new organizations and repaired on discovery for older organizations.

### Update organization

`PATCH /organization`

Owner/admin only. All fields are optional.

```json
{
  "name": "AKEEM Technologies",
  "logoUrl": "https://cdn.example.com/logo.png",
  "timezone": "Asia/Karachi",
  "currency": "PKR",
  "language": "en",
  "settings": {
    "dateFormat": "DD/MM/YYYY"
  }
}
```

### Invite member

`POST /organization/invitations`

Owner/admin only.

```json
{
  "email": "member@example.com",
  "roleId": 2
}
```

Alternatively, use a role name:

```json
{
  "email": "member@example.com",
  "role": "Member"
}
```

### Change member role

`PATCH /organization/members/:membershipId/role`

```json
{
  "roleId": 2
}
```

## User settings

### Update profile

`PATCH /users/me`

```json
{
  "firstName": "Ali",
  "lastName": "Khan",
  "phone": "+92-300-1234567"
}
```

### Change password

`PATCH /users/me/password`

```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword123"
}
```

### Update preferences

`PATCH /users/me/preferences`

```json
{
  "language": "de",
  "timezone": "Europe/Berlin",
  "emailNotifications": true,
  "browserNotifications": true
}
```

### Upload avatar

`POST /users/me/avatar`

Content type: `multipart/form-data`.

| Field    | Type | Required | Notes        |
| -------- | ---- | -------: | ------------ |
| `avatar` | File |      Yes | Maximum 5 MB |

```bash
curl --location 'http://localhost:3000/api/users/me/avatar' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --form 'avatar=@"C:/files/avatar.png"'
```

## Admin integrations

Owner/admin only.

### Create integration

`POST /admin/integrations`

```json
{
  "provider": "slack",
  "displayName": "Company Slack",
  "status": "connected",
  "credentials": {
    "accessToken": "provider-secret"
  },
  "settings": {
    "channelId": "C123456"
  }
}
```

### Update integration

`PATCH /admin/integrations/:id`

```json
{
  "displayName": "Operations Slack",
  "status": "connected",
  "settings": {
    "channelId": "C987654"
  }
}
```

Credentials are never returned by GET responses. Do not log credential payloads in the frontend.

## Delete requests

These endpoints require no body:

```http
DELETE /automations/:id
DELETE /crm/contacts/:id
DELETE /crm/companies/:id
DELETE /crm/deals/:id
DELETE /files/:id
DELETE /organization/members/:membershipId
DELETE /admin/integrations/:id
```

## Read endpoint query parameters

```text
GET /approvals?projectId=1&status=pending
GET /automations?projectId=1
GET /crm/contacts?page=1&limit=20&search=
GET /crm/companies?page=1&limit=20&search=
GET /crm/deals?page=1&limit=20&search=
GET /crm/pipelines
GET /finance/overview?projectId=1&period=month
GET /finance/transactions?page=1&limit=20&projectId=1&type=income
GET /finance/invoices?page=1&limit=20&projectId=1&status=draft
GET /finance/budgets?projectId=1
GET /finance/cash-flow?projectId=1&period=month
GET /files?projectId=1
GET /reports?projectId=1&assistant=ceo
GET /admin/audit-logs?page=1&limit=20
GET /admin/usage?period=2026-09
```

## QA reset

The backend owns a repeatable, isolated QA organization. Set `QA_EMAIL`,
`QA_PASSWORD`, and `QA_ORGANIZATION_NAME`, then run:

```bash
npm run qa:reset
```

The command is disabled when `NODE_ENV=production`. It removes only the
organization(s) linked to `QA_EMAIL`, recreates the account, roles, and one
project, then prints the IDs needed by a test run. Tests should discover the
project ID from `GET /projects` instead of persisting it.

Default local values are documented in `.env.example`.

## Provider and production behavior

- Invitation and reset-password email delivery uses the configured HTTP email
  provider (`EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`). Reset links target
  `/reset-password?token=...`; invitations target
  `/accept-invitation?token=...`.
- Automation `run` currently records an immediate completed run; a queue worker can replace this later.
- Report generation creates a persisted template unless `content` is supplied; AI-generated report execution can be connected later.
- Integration credentials are encrypted with AES-256-GCM before persistence and
  omitted from every API response. Production must supply a strong
  `INTEGRATION_ENCRYPTION_KEY`; a managed KMS can replace this adapter without
  changing the API contract.
- AI provider failures use safe error envelopes: `503
AI_PROVIDER_NOT_CONFIGURED` when no provider is configured and `502
AI_PROVIDER_ERROR` when the configured provider is temporarily unavailable.
