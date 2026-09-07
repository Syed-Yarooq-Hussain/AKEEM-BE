# Frontend integration: multi-agent chat

This is the frontend handoff for the contextual AI chat, direct department assistants, autonomous actions, conversation history, delegation visibility, and executable AI tasks.

## 1. Backend contract

Development base URL:

```text
http://localhost:3000/api
```

Every endpoint in this document requires the access token:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Successful responses are wrapped in `data`:

```json
{
  "success": true,
  "data": {}
}
```

Failed responses are not wrapped in `data`:

```json
{
  "success": false,
  "message": "Human-readable error",
  "code": "VALIDATION_ERROR",
  "errors": []
}
```

## 2. Where each assistant should appear

| Frontend area | Default assistant | Suggested context module |
|---|---|---|
| Global floating chat | `ceo` | Current route/module |
| Dashboard | `ceo` | `dashboard` |
| Executive reports | `executive` | `reports` |
| CRM, pipeline, deals | `sales` | `crm` |
| Finance, invoices, budgets | `finance` | `finance` |
| Campaigns/content | `marketing` | `marketing` |
| Contracts/compliance | `legal` | `legal` |
| Projects/tasks/delivery | `operations` | `projects` |
| Customer/account health | `customer-success` | `customer-success` |

Use one reusable chat drawer component everywhere. Only change its default assistant and page context. Users may switch assistants by loading the directory from `GET /ai/assistants`.

## 3. TypeScript types

```ts
export type AssistantKey =
  | 'ceo'
  | 'executive'
  | 'sales'
  | 'finance'
  | 'marketing'
  | 'legal'
  | 'operations'
  | 'customer-success';

export type ExecutionMode = 'auto' | 'suggest';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  errors: string[];
}

export interface ChatPageContext {
  module?: string;
  page?: string;
  entityType?: string;
  entityId?: number;
  selection?: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  projectId?: number;
  conversationId?: number;
  assistant?: AssistantKey;
  executionMode?: ExecutionMode;
  context?: ChatPageContext;
}

export type ActionType =
  | 'create_task'
  | 'create_draft_invoice'
  | 'create_budget'
  | 'create_report'
  | 'create_approval'
  | 'create_crm_activity';

export interface ActionResult {
  type: ActionType;
  status: 'executed' | 'proposed' | 'failed';
  reason: string;
  resource?: {
    type: 'task' | 'invoice' | 'budget' | 'report' | 'approval' | 'crm_activity';
    id: number;
  };
  data?: Record<string, unknown>;
  error?: string;
}

export interface DelegationResult {
  id: number;
  assistant: AssistantKey;
  objective: string;
  status: 'completed' | 'failed';
  answer: string;
  model?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  actions: ActionResult[];
  error?: string;
}

export interface ChatResponse {
  conversationId: number;
  messageId: number;
  projectId: number | null;
  assistant: AssistantKey;
  answer: string;
  model: string;
  routing: {
    delegated: boolean;
    specialists: AssistantKey[];
  };
  delegations: DelegationResult[];
  actions: ActionResult[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  createdAt: string;
}

export interface AssistantDirectoryItem {
  key: AssistantKey;
  label: string;
  description: string;
  capabilities: string[];
  actions: ActionType[];
  model: string;
}
```

## 4. API client

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public errors: string[] = [],
  ) {
    super(message);
  }
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.message ?? 'Request failed',
      payload.code ?? 'UNKNOWN_ERROR',
      response.status,
      payload.errors ?? [],
    );
  }
  return payload.data as T;
}

export function getAssistants(token: string) {
  return api<{
    items: AssistantDirectoryItem[];
    defaultAssistant: AssistantKey;
    executionModes: ExecutionMode[];
  }>('/ai/assistants', token);
}

export function sendChatMessage(token: string, input: ChatRequest) {
  return api<ChatResponse>('/ai/chat', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function sendDirectMessage(
  token: string,
  assistant: AssistantKey,
  input: Omit<ChatRequest, 'assistant'>,
) {
  return api<ChatResponse>(`/ai/${assistant}/chat`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
```

Use `/ai/chat` for the global CEO entry point. Use `/ai/:assistant/chat` inside a department screen where the assistant is fixed. The direct route ignores an `assistant` value in the request body.

## 5. Sending screen context

Project page example:

```ts
const result = await sendChatMessage(token, {
  assistant: 'ceo',
  projectId: project.id,
  message: inputText,
  conversationId: activeConversationId,
  executionMode: 'auto',
  context: {
    module: 'projects',
    page: 'project-detail',
    entityType: 'project',
    entityId: project.id,
    selection: {
      activeTab,
      selectedTaskId,
    },
  },
});
```

Finance page without a selected project:

```ts
await sendDirectMessage(token, 'finance', {
  message: 'Review this month cash flow and identify the biggest risk.',
  executionMode: 'suggest',
  context: {
    module: 'finance',
    page: 'cash-flow',
    selection: { period: '2026-09' },
  },
});
```

Rules:

- `projectId` is optional for chat.
- Keep the same `assistant` and `projectId` while continuing a `conversationId`.
- Start a new conversation when the user changes project or assistant.
- Only send IDs and compact UI state in `selection`; do not send secrets, access tokens, or complete records.
- The backend reads canonical business data itself. Page context helps it understand what the user is viewing.

## 6. Chat drawer state

Minimum local state:

```ts
interface ChatState {
  assistant: AssistantKey;
  projectId?: number;
  conversationId?: number;
  executionMode: ExecutionMode;
  messages: ChatUiMessage[];
  sending: boolean;
  error?: string;
}

interface ChatUiMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  delegations?: DelegationResult[];
  actions?: ActionResult[];
}
```

Send flow:

1. Add the user's message optimistically.
2. Disable duplicate submission and show “Agent team is working…”.
3. Call the chat endpoint and save its `conversationId`.
4. Add `answer` as the assistant message.
5. Render `delegations` and `actions` below that message.
6. Invalidate affected frontend queries for every executed resource.
7. On failure, keep the user's message and show a retry action.

The current API is request/response, not streaming. A CEO request may make several model calls and execute multiple actions, so keep the loading UI visible until the POST resolves. Do not simulate fake streaming text.

## 7. Rendering delegation and action status

Recommended labels:

```ts
export const actionLabels: Record<ActionType, string> = {
  create_task: 'Task created',
  create_draft_invoice: 'Draft invoice created',
  create_budget: 'Budget created',
  create_report: 'Report created',
  create_approval: 'Approval requested',
  create_crm_activity: 'CRM activity created',
};
```

Status presentation:

| Status | UI treatment |
|---|---|
| `executed` | Green success row with a resource link |
| `proposed` | Neutral preview row; no resource link |
| `failed` | Red/error row using the action's `error` text |
| Delegation `completed` | Specialist badge with optional collapsible answer |
| Delegation `failed` | Warning badge; the main answer may still contain other successful work |

Resource navigation map:

```ts
export function actionResourceUrl(action: ActionResult): string | undefined {
  if (!action.resource) return undefined;
  const { type, id } = action.resource;
  const paths: Partial<Record<typeof type, string>> = {
    task: `/tasks/${id}`,
    invoice: `/finance/invoices/${id}`,
    budget: `/finance/budgets/${id}`,
    report: `/reports/${id}`,
    approval: `/approvals/${id}`,
    crm_activity: `/crm/activities/${id}`,
  };
  return paths[type];
}
```

After an executed action, invalidate/refetch the corresponding list and project/dashboard summary. A successful HTTP response does not mean every action succeeded; always inspect each action's `status`.

## 8. Conversation history

```http
GET /ai/conversations?projectId=1&assistant=finance&page=1&limit=20
GET /ai/conversations/:conversationId/messages
DELETE /ai/conversations/:conversationId
```

Project and assistant filters are optional on the unified conversation list. Messages include `toolCalls` and `metadata`, so historical action/delegation cards can be reconstructed.

Example client functions:

```ts
export function listConversations(
  token: string,
  filters: { projectId?: number; assistant?: AssistantKey; page?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (filters.projectId) query.set('projectId', String(filters.projectId));
  if (filters.assistant) query.set('assistant', filters.assistant);
  query.set('page', String(filters.page ?? 1));
  query.set('limit', String(filters.limit ?? 20));
  return api(`/ai/conversations?${query}`, token);
}

export function getConversationMessages(token: string, conversationId: number) {
  return api(`/ai/conversations/${conversationId}/messages`, token);
}
```

## 9. Delegation activity screen

Admin/debug or activity UI can use:

```http
GET /ai/delegations?conversationId=18
GET /ai/delegations?projectId=1&status=completed&page=1&limit=20
GET /ai/delegations/:delegationId
```

Supported status filters are `pending`, `running`, `completed`, and `failed`.

Show:

- Source agent and target specialist.
- Delegated objective.
- Start/completion timestamps.
- Specialist answer and model.
- Token usage.
- Executed/proposed/failed actions.
- Failure text when present.

## 10. AI task UI

Create and execute immediately:

```http
POST /ai/tasks
```

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

Queue without running by setting `runNow: false`. Run and retry endpoints:

```http
POST /ai/tasks/:id/run
POST /ai/tasks/:id/retry
POST /ai/tasks/:id/cancel
```

Task statuses are `queued`, `running`, `completed`, `failed`, and `cancelled`. A completed task's `output` contains `conversationId`, `messageId`, `answer`, routing, delegations, actions, and usage.

## 11. Error handling

| HTTP/code | Frontend behavior |
|---|---|
| `400 / VALIDATION_ERROR` | Mark invalid fields and show the first message |
| `401 / UNAUTHORIZED` | Refresh the token once, then redirect to login |
| `403 / FORBIDDEN` | Conversation belongs to another assistant/project/user; open a new thread |
| `404 / PROJECT_NOT_FOUND` | Clear stale selected project and refresh project data |
| `404 / NOT_FOUND` | Remove stale conversation/delegation from local state |
| `422 / BUSINESS_VALIDATION_ERROR` | Show the business rule message next to the attempted action |
| `502` | Model/provider call failed; offer retry without deleting the user message |
| `503` | OpenAI is not configured; disable send and show configuration notice |

Never expose provider errors, tokens, or stack traces in toast messages. Use `message` for the user and log `code` plus request context to frontend monitoring.

## 12. Acceptance checklist

- Global chat defaults to CEO and is reachable from every authenticated screen.
- Department screens open their matching direct assistant.
- Changing assistant or project starts a new conversation.
- The user can choose `auto` or `suggest` before sending.
- Loading state explains that multiple agents may be working.
- Delegated specialists appear as status badges/cards.
- Action cards distinguish executed, proposed, and failed states.
- Executed resources link to their detail screens and invalidate stale queries.
- Conversation history restores after page refresh.
- 401 refresh/login handling works.
- 502/503 errors preserve the draft and offer retry.
- Mobile drawer layout supports long answers and collapsible delegation details.

