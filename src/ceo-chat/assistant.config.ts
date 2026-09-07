export const ASSISTANTS = [
  'ceo',
  'executive',
  'sales',
  'finance',
  'marketing',
  'legal',
  'operations',
  'customer-success',
] as const;

export type AssistantKey = (typeof ASSISTANTS)[number];

export type AssistantDefinition = {
  label: string;
  description: string;
  capabilities: string[];
  actions: string[];
};

export const ASSISTANT_DEFINITIONS: Record<AssistantKey, AssistantDefinition> =
  {
    ceo: {
      label: 'CEO',
      description:
        'Primary business orchestrator. Breaks cross-functional requests into specialist assignments and combines the results.',
      capabilities: [
        'strategy',
        'prioritization',
        'cross-functional orchestration',
        'executive decisions',
      ],
      actions: ['create_task', 'create_report', 'create_approval'],
    },
    executive: {
      label: 'Executive',
      description:
        'Executive planning, business reviews, operating cadence, and leadership summaries.',
      capabilities: [
        'executive planning',
        'business reviews',
        'risk synthesis',
        'leadership reporting',
      ],
      actions: ['create_task', 'create_report', 'create_approval'],
    },
    sales: {
      label: 'Sales',
      description:
        'Pipeline, deals, accounts, commercial follow-up, and sales execution.',
      capabilities: [
        'pipeline analysis',
        'deal strategy',
        'sales follow-up',
        'CRM activity',
      ],
      actions: [
        'create_task',
        'create_crm_activity',
        'create_report',
        'create_approval',
      ],
    },
    finance: {
      label: 'Finance',
      description:
        'Budgets, cash flow, invoices, expenses, profitability, and financial controls.',
      capabilities: [
        'financial analysis',
        'budgeting',
        'cash flow',
        'invoicing',
        'financial controls',
      ],
      actions: [
        'create_task',
        'create_draft_invoice',
        'create_budget',
        'create_report',
        'create_approval',
      ],
    },
    marketing: {
      label: 'Marketing',
      description:
        'Campaign planning, positioning, content, launch plans, and growth analysis.',
      capabilities: [
        'campaign planning',
        'positioning',
        'content briefs',
        'growth analysis',
      ],
      actions: ['create_task', 'create_report', 'create_approval'],
    },
    legal: {
      label: 'Legal',
      description:
        'Operational legal review, contract issue spotting, compliance checklists, and approval routing. It does not provide legal advice.',
      capabilities: [
        'contract issue spotting',
        'compliance checklist',
        'policy review',
        'approval routing',
      ],
      actions: ['create_task', 'create_report', 'create_approval'],
    },
    operations: {
      label: 'Operations',
      description:
        'Project delivery, processes, task planning, dependencies, and operational risk.',
      capabilities: [
        'delivery planning',
        'process design',
        'task execution',
        'risk management',
      ],
      actions: ['create_task', 'create_report', 'create_approval'],
    },
    'customer-success': {
      label: 'Customer Success',
      description:
        'Onboarding, adoption, retention, account health, and customer follow-up.',
      capabilities: [
        'onboarding',
        'account health',
        'retention planning',
        'customer follow-up',
      ],
      actions: [
        'create_task',
        'create_crm_activity',
        'create_report',
        'create_approval',
      ],
    },
  };

export const ACTION_TYPES = [
  'create_task',
  'create_draft_invoice',
  'create_budget',
  'create_report',
  'create_approval',
  'create_crm_activity',
] as const;

export type AgentActionType = (typeof ACTION_TYPES)[number];

export function isAssistant(value: string): value is AssistantKey {
  return ASSISTANTS.includes(value as AssistantKey);
}

export function modelForAssistant(assistant: AssistantKey): string {
  const envKey = `OPENAI_${assistant.replace(/-/g, '_').toUpperCase()}_MODEL`;
  return process.env[envKey] || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

export function orchestratorModel(): string {
  return process.env.OPENAI_ORCHESTRATOR_MODEL || modelForAssistant('ceo');
}

export function publicAssistantDirectory() {
  return ASSISTANTS.map((key) => ({
    key,
    ...ASSISTANT_DEFINITIONS[key],
    model: modelForAssistant(key),
  }));
}
