'use strict';

const tableOrder = [
  'organizations', 'users', 'roles', 'permissions', 'plans', 'memberships',
  'role_permissions', 'subscriptions', 'companies', 'contacts', 'pipelines',
  'pipeline_stages', 'deals', 'crm_activities', 'projects', 'tasks',
  'task_assignees', 'task_comments', 'departments', 'employees',
  'leave_requests', 'attendance_entries', 'financial_accounts',
  'transaction_categories', 'transactions', 'invoices', 'invoice_items',
  'payments', 'expenses', 'ai_agents', 'ai_conversations', 'ai_messages',
  'knowledge_documents', 'automations', 'automation_runs', 'integrations',
  'ai_agent_teams', 'ai_agent_team_members', 'ai_agent_delegations',
  'files', 'notifications', 'audit_logs',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { STRING, TEXT, DATE, DATEONLY, BOOLEAN, INTEGER, BIGINT, DECIMAL, JSONB, ARRAY } = Sequelize;
    const id = () => ({ type: INTEGER, autoIncrement: true, primaryKey: true, allowNull: false });
    const fk = (table, allowNull = false) => ({ type: INTEGER, allowNull, references: { model: table, key: 'id' }, onUpdate: 'CASCADE', onDelete: allowNull ? 'SET NULL' : 'CASCADE' });
    const base = (softDelete = true) => ({
      id: id(), created_at: { type: DATE, allowNull: false }, updated_at: { type: DATE, allowNull: false },
      ...(softDelete ? { deleted_at: { type: DATE, allowNull: true } } : {}),
    });
    const tenant = () => ({ organization_id: fk('organizations') });
    const money = () => ({ type: DECIMAL(16, 2), allowNull: false, defaultValue: 0 });

    const schemas = {
      organizations: { ...base(), name: { type: STRING, allowNull: false }, slug: { type: STRING, allowNull: false, unique: true }, logo_url: STRING, timezone: { type: STRING, defaultValue: 'UTC' }, currency: { type: STRING, defaultValue: 'USD' }, locale: { type: STRING, defaultValue: 'en' }, settings: { type: JSONB, defaultValue: {} }, status: { type: STRING, defaultValue: 'active' } },
      users: { ...base(), first_name: { type: STRING, allowNull: false }, last_name: { type: STRING, allowNull: false }, email: { type: STRING, allowNull: false, unique: true }, phone: STRING, avatar_url: STRING, password_hash: STRING, last_login_at: DATE, email_verified_at: DATE, status: { type: STRING, defaultValue: 'active' }, preferences: { type: JSONB, defaultValue: {} } },
      roles: { ...base(), organization_id: fk('organizations', true), name: { type: STRING, allowNull: false }, description: TEXT, is_system: { type: BOOLEAN, defaultValue: false } },
      permissions: { ...base(false), key: { type: STRING, allowNull: false, unique: true }, module: { type: STRING, allowNull: false }, description: TEXT },
      plans: { ...base(), code: { type: STRING, allowNull: false, unique: true }, name: { type: STRING, allowNull: false }, monthly_price: { type: DECIMAL(12, 2), defaultValue: 0 }, yearly_price: { type: DECIMAL(12, 2), defaultValue: 0 }, limits: { type: JSONB, defaultValue: {} }, features: { type: JSONB, defaultValue: [] }, is_active: { type: BOOLEAN, defaultValue: true } },
      memberships: { ...base(), ...tenant(), user_id: fk('users'), role_id: fk('roles'), status: { type: STRING, defaultValue: 'active' }, job_title: STRING, invited_at: DATE, joined_at: DATE },
      role_permissions: { ...base(false), role_id: fk('roles'), permission_id: fk('permissions') },
      subscriptions: { ...base(), ...tenant(), plan_id: fk('plans'), status: { type: STRING, defaultValue: 'trialing' }, provider: STRING, provider_customer_id: STRING, provider_subscription_id: STRING, trial_ends_at: DATE, current_period_start: DATE, current_period_end: DATE, cancel_at: DATE },
      companies: { ...base(), ...tenant(), name: { type: STRING, allowNull: false }, domain: STRING, industry: STRING, phone: STRING, website: STRING, address: { type: JSONB, defaultValue: {} }, custom_fields: { type: JSONB, defaultValue: {} }, tags: { type: ARRAY(STRING), defaultValue: [] } },
      contacts: { ...base(), ...tenant(), company_id: fk('companies', true), owner_id: fk('users', true), first_name: { type: STRING, allowNull: false }, last_name: STRING, email: STRING, phone: STRING, job_title: STRING, lifecycle_stage: { type: STRING, defaultValue: 'lead' }, custom_fields: { type: JSONB, defaultValue: {} }, tags: { type: ARRAY(STRING), defaultValue: [] } },
      pipelines: { ...base(), ...tenant(), name: { type: STRING, allowNull: false }, is_default: { type: BOOLEAN, defaultValue: true } },
      pipeline_stages: { ...base(), pipeline_id: fk('pipelines'), name: { type: STRING, allowNull: false }, position: { type: INTEGER, defaultValue: 0 }, probability: { type: INTEGER, defaultValue: 0 }, color: STRING },
      deals: { ...base(), ...tenant(), pipeline_id: fk('pipelines'), stage_id: fk('pipeline_stages'), company_id: fk('companies', true), contact_id: fk('contacts', true), owner_id: fk('users', true), title: { type: STRING, allowNull: false }, value: { type: DECIMAL(14, 2), defaultValue: 0 }, currency: { type: STRING, defaultValue: 'USD' }, expected_close_date: DATE, status: { type: STRING, defaultValue: 'open' }, lost_reason: TEXT },
      crm_activities: { ...base(), ...tenant(), contact_id: fk('contacts', true), company_id: fk('companies', true), deal_id: fk('deals', true), user_id: fk('users'), type: { type: STRING, allowNull: false }, subject: STRING, body: TEXT, occurred_at: DATE, metadata: { type: JSONB, defaultValue: {} } },
      projects: { ...base(), ...tenant(), company_id: fk('companies', true), contact_id: fk('contacts', true), deal_id: fk('deals', true), owner_id: fk('users', true), name: { type: STRING, allowNull: false }, description: TEXT, status: { type: STRING, defaultValue: 'planned' }, color: STRING, start_date: DATEONLY, due_date: DATEONLY, budget: { type: DECIMAL(14, 2) }, settings: { type: JSONB, defaultValue: {} } },
      tasks: { ...base(), ...tenant(), project_id: fk('projects', true), parent_task_id: fk('tasks', true), created_by_id: fk('users'), title: { type: STRING, allowNull: false }, description: TEXT, status: { type: STRING, defaultValue: 'todo' }, priority: { type: STRING, defaultValue: 'medium' }, start_at: DATE, due_at: DATE, completed_at: DATE, estimated_hours: { type: DECIMAL(8, 2) }, position: { type: INTEGER, defaultValue: 0 } },
      task_assignees: { ...base(false), task_id: fk('tasks'), user_id: fk('users') },
      task_comments: { ...base(), task_id: fk('tasks'), user_id: fk('users'), parent_id: fk('task_comments', true), body: { type: TEXT, allowNull: false }, mentions: { type: JSONB, defaultValue: [] } },
      departments: { ...base(), ...tenant(), manager_id: fk('users', true), name: { type: STRING, allowNull: false }, description: TEXT },
      employees: { ...base(), ...tenant(), user_id: fk('users', true), department_id: fk('departments', true), manager_employee_id: fk('employees', true), employee_number: { type: STRING, allowNull: false }, first_name: { type: STRING, allowNull: false }, last_name: { type: STRING, allowNull: false }, work_email: STRING, phone: STRING, job_title: STRING, employment_type: STRING, hire_date: DATEONLY, termination_date: DATEONLY, status: { type: STRING, defaultValue: 'active' }, salary: { type: DECIMAL(14, 2) }, salary_currency: STRING, emergency_contact: { type: JSONB, defaultValue: {} } },
      leave_requests: { ...base(), ...tenant(), employee_id: fk('employees'), reviewed_by_id: fk('users', true), type: { type: STRING, allowNull: false }, start_date: DATEONLY, end_date: DATEONLY, days: { type: DECIMAL(5, 2) }, status: { type: STRING, defaultValue: 'pending' }, reason: TEXT, review_note: TEXT },
      attendance_entries: { ...base(), ...tenant(), employee_id: fk('employees'), clock_in: DATE, clock_out: DATE, hours: { type: DECIMAL(6, 2) }, status: { type: STRING, defaultValue: 'present' }, note: TEXT },
      financial_accounts: { ...base(), ...tenant(), name: { type: STRING, allowNull: false }, type: { type: STRING, allowNull: false }, institution: STRING, last_four: STRING, currency: { type: STRING, defaultValue: 'USD' }, opening_balance: money(), is_active: { type: BOOLEAN, defaultValue: true } },
      transaction_categories: { ...base(), ...tenant(), parent_id: fk('transaction_categories', true), name: { type: STRING, allowNull: false }, type: { type: STRING, allowNull: false }, color: STRING },
      transactions: { ...base(), ...tenant(), account_id: fk('financial_accounts'), category_id: fk('transaction_categories', true), company_id: fk('companies', true), project_id: fk('projects', true), type: { type: STRING, allowNull: false }, amount: money(), currency: { type: STRING, defaultValue: 'USD' }, transaction_date: { type: DATE, allowNull: false }, description: TEXT, reference: STRING, status: { type: STRING, defaultValue: 'cleared' }, metadata: { type: JSONB, defaultValue: {} } },
      invoices: { ...base(), ...tenant(), company_id: fk('companies', true), contact_id: fk('contacts', true), project_id: fk('projects', true), invoice_number: { type: STRING, allowNull: false }, status: { type: STRING, defaultValue: 'draft' }, issue_date: DATEONLY, due_date: DATEONLY, currency: { type: STRING, defaultValue: 'USD' }, subtotal: money(), tax_total: money(), discount_total: money(), total: money(), amount_paid: money(), notes: TEXT, sent_at: DATE, paid_at: DATE },
      invoice_items: { ...base(), invoice_id: fk('invoices'), description: { type: STRING, allowNull: false }, quantity: { type: DECIMAL(12, 3), defaultValue: 1 }, unit_price: money(), tax_rate: { type: DECIMAL(7, 4), defaultValue: 0 }, line_total: money(), position: { type: INTEGER, defaultValue: 0 } },
      payments: { ...base(), ...tenant(), invoice_id: fk('invoices', true), account_id: fk('financial_accounts', true), amount: money(), currency: { type: STRING, defaultValue: 'USD' }, paid_at: DATE, method: STRING, reference: STRING, status: { type: STRING, defaultValue: 'completed' } },
      expenses: { ...base(), ...tenant(), submitted_by_id: fk('users'), approved_by_id: fk('users', true), category_id: fk('transaction_categories', true), project_id: fk('projects', true), merchant: { type: STRING, allowNull: false }, amount: money(), currency: { type: STRING, defaultValue: 'USD' }, expense_date: DATEONLY, status: { type: STRING, defaultValue: 'pending' }, receipt_url: STRING, note: TEXT },
      ai_agents: { ...base(), ...tenant(), created_by_id: fk('users'), name: { type: STRING, allowNull: false }, description: TEXT, avatar_url: STRING, system_prompt: TEXT, model: STRING, temperature: { type: DECIMAL(3, 2), defaultValue: 0.7 }, tools: { type: JSONB, defaultValue: [] }, status: { type: STRING, defaultValue: 'active' } },
      ai_conversations: { ...base(), ...tenant(), agent_id: fk('ai_agents'), user_id: fk('users', true), initiated_by_agent_id: fk('ai_agents', true), title: STRING, status: { type: STRING, defaultValue: 'active' }, context: { type: JSONB, defaultValue: {} }, last_message_at: DATE },
      ai_messages: { ...base(), conversation_id: fk('ai_conversations'), sender_agent_id: fk('ai_agents', true), recipient_agent_id: fk('ai_agents', true), role: { type: STRING, allowNull: false }, content: { type: TEXT, allowNull: false }, model: STRING, input_tokens: { type: INTEGER, defaultValue: 0 }, output_tokens: { type: INTEGER, defaultValue: 0 }, tool_calls: { type: JSONB, defaultValue: [] }, metadata: { type: JSONB, defaultValue: {} } },
      knowledge_documents: { ...base(), ...tenant(), agent_id: fk('ai_agents', true), uploaded_by_id: fk('users'), title: { type: STRING, allowNull: false }, source_type: STRING, source_url: STRING, storage_key: STRING, mime_type: STRING, size_bytes: BIGINT, processing_status: { type: STRING, defaultValue: 'pending' }, metadata: { type: JSONB, defaultValue: {} } },
      automations: { ...base(), ...tenant(), created_by_id: fk('users'), name: { type: STRING, allowNull: false }, description: TEXT, trigger: { type: JSONB, allowNull: false }, actions: { type: JSONB, defaultValue: [] }, is_active: { type: BOOLEAN, defaultValue: false }, last_run_at: DATE, next_run_at: DATE },
      automation_runs: { ...base(), ...tenant(), automation_id: fk('automations'), status: { type: STRING, defaultValue: 'queued' }, input: { type: JSONB, defaultValue: {} }, output: { type: JSONB, defaultValue: {} }, error: TEXT, started_at: DATE, finished_at: DATE },
      integrations: { ...base(), ...tenant(), provider: { type: STRING, allowNull: false }, display_name: STRING, status: { type: STRING, defaultValue: 'connected' }, credentials_encrypted: { type: JSONB, defaultValue: {} }, settings: { type: JSONB, defaultValue: {} }, last_synced_at: DATE },
      ai_agent_teams: { ...base(), ...tenant(), created_by_id: fk('users'), name: { type: STRING, allowNull: false }, description: TEXT, status: { type: STRING, defaultValue: 'active' }, orchestration_config: { type: JSONB, defaultValue: {} } },
      ai_agent_team_members: { ...base(false), team_id: fk('ai_agent_teams'), agent_id: fk('ai_agents'), role: { type: STRING, defaultValue: 'worker' }, priority: { type: INTEGER, defaultValue: 0 }, capabilities: { type: JSONB, defaultValue: [] } },
      ai_agent_delegations: { ...base(), ...tenant(), conversation_id: fk('ai_conversations', true), from_agent_id: fk('ai_agents'), to_agent_id: fk('ai_agents'), parent_delegation_id: fk('ai_agent_delegations', true), objective: { type: STRING, allowNull: false }, input: { type: JSONB, defaultValue: {} }, output: { type: JSONB, defaultValue: {} }, status: { type: STRING, defaultValue: 'pending' }, attempt_count: { type: INTEGER, defaultValue: 0 }, started_at: DATE, completed_at: DATE, error: TEXT },
      files: { ...base(), ...tenant(), uploaded_by_id: fk('users'), original_name: { type: STRING, allowNull: false }, storage_key: { type: STRING, allowNull: false }, mime_type: STRING, size_bytes: BIGINT, entity_type: STRING, entity_id: INTEGER, metadata: { type: JSONB, defaultValue: {} } },
      notifications: { ...base(), ...tenant(), user_id: fk('users'), type: { type: STRING, allowNull: false }, title: { type: STRING, allowNull: false }, body: TEXT, action_url: STRING, data: { type: JSONB, defaultValue: {} }, read_at: DATE },
      audit_logs: { ...base(false), ...tenant(), actor_id: fk('users', true), action: { type: STRING, allowNull: false }, entity_type: { type: STRING, allowNull: false }, entity_id: INTEGER, before: JSONB, after: JSONB, ip_address: STRING, user_agent: TEXT, metadata: { type: JSONB, defaultValue: {} } },
    };

    for (const table of tableOrder) await queryInterface.createTable(table, schemas[table]);

    const uniqueIndexes = [
      ['memberships', ['organization_id', 'user_id']], ['role_permissions', ['role_id', 'permission_id']],
      ['task_assignees', ['task_id', 'user_id']], ['employees', ['organization_id', 'employee_number']],
      ['invoices', ['organization_id', 'invoice_number']],
      ['ai_agent_team_members', ['team_id', 'agent_id']],
    ];
    for (const [table, fields] of uniqueIndexes) await queryInterface.addIndex(table, fields, { unique: true });

    const tenantTables = tableOrder.filter((table) => schemas[table].organization_id);
    for (const table of tenantTables) await queryInterface.addIndex(table, ['organization_id']);
  },

  async down(queryInterface) {
    for (const table of [...tableOrder].reverse()) await queryInterface.dropTable(table);
  },
};
