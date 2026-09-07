# Multi-agent chat and autonomous execution

The backend exposes one primary contextual chat plus direct chats for every specialist. The CEO and Executive assistants act as orchestrators: they inspect current business data, route independent work to specialists in parallel, persist every delegation, execute allowlisted in-app actions, and synthesize one answer.

Frontend engineers should use the implementation-specific [FE integration guide](./FE_AI_AGENT_INTEGRATION.md).

All endpoints are authenticated and organization-scoped. Successful responses are wrapped as `{ "success": true, "data": ... }`.

## Available assistants

- `ceo`
- `executive`
- `sales`
- `finance`
- `marketing`
- `legal`
- `operations`
- `customer-success`

List their configured models, capabilities, and allowed actions:

```http
GET /api/ai/assistants
Authorization: Bearer ACCESS_TOKEN
```

Each assistant can use a separate model through `OPENAI_<ASSISTANT>_MODEL`. Hyphens become underscores, so Customer Success uses `OPENAI_CUSTOMER_SUCCESS_MODEL`. Missing overrides fall back to `OPENAI_MODEL`. Routing uses `OPENAI_ORCHESTRATOR_MODEL`.

## Unified contextual chat

Use this route for a global chat drawer or a chat widget on any screen:

```http
POST /api/ai/chat
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "projectId": 1,
  "assistant": "ceo",
  "message": "Check our cash position, prepare a budget, and make tasks for the overdue delivery work.",
  "executionMode": "auto",
  "context": {
    "module": "dashboard",
    "page": "project-overview",
    "entityType": "project",
    "entityId": 1,
    "selection": {}
  }
}
```

`projectId` is optional. Omit it for organization-wide Finance, Sales, or Executive chat. Continue a thread by sending the returned `conversationId` with the same assistant and project context.

`executionMode` controls mutations:

- `auto` (default): executes allowlisted, reversible in-app actions.
- `suggest`: returns action previews without writing business records.

The response includes the final answer, selected specialists, persisted delegation IDs, action statuses and created resource IDs, model names, and total token usage.

```json
{
  "conversationId": 18,
  "messageId": 93,
  "projectId": 1,
  "assistant": "ceo",
  "answer": "Finance prepared the budget and Operations created the delivery task.",
  "routing": {
    "delegated": true,
    "specialists": ["finance", "operations"]
  },
  "delegations": [
    {
      "id": 41,
      "assistant": "finance",
      "status": "completed"
    }
  ],
  "actions": [
    {
      "type": "create_budget",
      "status": "executed",
      "resource": { "type": "budget", "id": 7 }
    }
  ]
}
```

## Direct specialist chat

Every specialist also has a direct endpoint for its own module:

```http
POST /api/ai/finance/chat
POST /api/ai/sales/chat
POST /api/ai/marketing/chat
POST /api/ai/legal/chat
POST /api/ai/operations/chat
POST /api/ai/customer-success/chat
POST /api/ai/executive/chat
```

The request body is the same as unified chat; `assistant` in the body is ignored because the route determines the specialist.

Conversation APIs:

```http
GET /api/ai/conversations?projectId=1&assistant=finance
GET /api/ai/conversations/:id/messages
DELETE /api/ai/conversations/:id
```

The legacy specialist-scoped conversation routes remain available.

## Safe action policy

Agents can only request actions allowed by the server-side assistant registry. The runtime validates payloads and tenant ownership before writing anything.

Supported actions:

- Create a project task.
- Create a draft invoice. It cannot send the invoice or record payment.
- Create a budget plan.
- Create a Markdown report.
- Create an approval request and notify the current user.
- Create a CRM activity/note.

Every executed action creates an audit log. Destructive actions, invoice sending, payments, bank transactions, external messages, and credential changes are not exposed to the model. They must go through an explicit application workflow or approval.

## Delegation visibility

```http
GET /api/ai/delegations?projectId=1&status=completed&page=1&limit=20
GET /api/ai/delegations/:id
```

Delegation records contain the source and target agents, objective, inputs, output, model usage, action results, timestamps, and errors.

## Executable AI tasks

`POST /api/ai/tasks` now runs immediately by default and persists the final chat, delegations, actions, and usage in `output`.

```json
{
  "projectId": 1,
  "title": "Prepare monthly finance review",
  "description": "Analyze cash flow and create a September budget report.",
  "assistant": "finance",
  "priority": "high",
  "executionMode": "auto",
  "runNow": true,
  "input": { "period": "2026-09" }
}
```

Set `runNow` to `false` to leave it queued. Execute later with `POST /api/ai/tasks/:id/run`. Failed or cancelled tasks can be executed again with `POST /api/ai/tasks/:id/retry`.
