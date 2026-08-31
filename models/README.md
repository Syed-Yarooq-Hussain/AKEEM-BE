# Domain model map

- `core.models.ts`: organizations, users, memberships, RBAC, plans and subscriptions
- `crm.models.ts`: companies, contacts, pipelines, deals and customer activity
- `work.models.ts`: projects, nested tasks, assignees and comments
- `hr.models.ts`: departments, employees, leave and attendance
- `finance.models.ts`: accounts, ledger transactions, invoices, payments and expenses
- `automation.models.ts`: AI agents, agent teams, inter-agent delegation/messages, chat history, knowledge, workflows and integrations
- `system.models.ts`: shared files, notifications and immutable audit events

`index.ts` exports every model and the `SAAS_MODELS` registry used by NestJS. Domain modules should import these shared models rather than defining private copies.

All primary keys use PostgreSQL auto-incrementing integers; related foreign keys use the same integer type.
