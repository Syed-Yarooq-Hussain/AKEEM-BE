import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  AiAgent,
  Approval,
  AuditLog,
  Budget,
  Company,
  Contact,
  CrmActivity,
  Deal,
  Invoice,
  InvoiceItem,
  Notification,
  Project,
  Report,
  Task,
} from '../../models';
import {
  AgentActionType,
  ASSISTANT_DEFINITIONS,
  AssistantKey,
} from './assistant.config';

type AuthUser = { id: number; organizationId: number };
type RequestedAction = {
  type: AgentActionType;
  payload: string;
  reason: string;
};

export type ActionResult = {
  type: AgentActionType;
  status: 'executed' | 'proposed' | 'failed';
  reason: string;
  resource?: { type: string; id: number };
  data?: object;
  error?: string;
};

@Injectable()
export class AgentActionService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Task) private readonly tasks: typeof Task,
    @InjectModel(Company) private readonly companies: typeof Company,
    @InjectModel(Contact) private readonly contacts: typeof Contact,
    @InjectModel(Deal) private readonly deals: typeof Deal,
    @InjectModel(Invoice) private readonly invoices: typeof Invoice,
    @InjectModel(InvoiceItem) private readonly invoiceItems: typeof InvoiceItem,
    @InjectModel(Budget) private readonly budgets: typeof Budget,
    @InjectModel(Report) private readonly reports: typeof Report,
    @InjectModel(Approval) private readonly approvals: typeof Approval,
    @InjectModel(CrmActivity)
    private readonly crmActivities: typeof CrmActivity,
    @InjectModel(Notification)
    private readonly notifications: typeof Notification,
    @InjectModel(AuditLog) private readonly auditLogs: typeof AuditLog,
  ) {}

  async execute(
    auth: AuthUser,
    project: Project | null,
    agent: AiAgent,
    assistant: AssistantKey,
    requested: RequestedAction[],
    executionMode: 'auto' | 'suggest',
  ): Promise<ActionResult[]> {
    const allowed = new Set(ASSISTANT_DEFINITIONS[assistant].actions);
    const results: ActionResult[] = [];

    for (const action of requested.slice(0, 6)) {
      try {
        if (!allowed.has(action.type))
          throw new Error(`${assistant} is not allowed to run this action`);
        if (executionMode === 'suggest') {
          results.push({
            type: action.type,
            status: 'proposed',
            reason: action.reason,
            data: this.parsePayload(action.payload),
          });
        } else {
          results.push(
            await this.executeOne(auth, project, agent, assistant, action),
          );
        }
      } catch (error) {
        results.push({
          type: action.type,
          status: 'failed',
          reason: action.reason,
          error: error instanceof Error ? error.message : 'Action failed',
        });
      }
    }
    return results;
  }

  private async executeOne(
    auth: AuthUser,
    project: Project | null,
    agent: AiAgent,
    assistant: AssistantKey,
    action: RequestedAction,
  ): Promise<ActionResult> {
    const payload = this.parsePayload(action.payload);
    let resource: { type: string; id: number };
    let data: object;

    switch (action.type) {
      case 'create_task': {
        if (!project) throw new Error('A project is required to create a task');
        const title = this.text(payload.title, 'Task title', 180);
        const task = await this.tasks.create({
          organizationId: auth.organizationId,
          projectId: project.id,
          createdById: auth.id,
          title,
          description: this.optionalText(payload.description, 4000),
          status: 'todo',
          priority: this.oneOf(
            payload.priority,
            ['low', 'medium', 'high', 'urgent'],
            'medium',
          ),
          dueAt: this.optionalDate(payload.dueAt),
          position: 0,
        });
        resource = { type: 'task', id: task.id };
        data = {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
        };
        break;
      }
      case 'create_draft_invoice': {
        const companyId = this.optionalInteger(payload.companyId);
        if (
          companyId &&
          !(await this.companies.findOne({
            where: { id: companyId, organizationId: auth.organizationId },
          }))
        ) {
          throw new Error(
            'Invoice company does not belong to the organization',
          );
        }
        const contactId = this.optionalInteger(payload.contactId);
        if (
          contactId &&
          !(await this.contacts.findOne({
            where: { id: contactId, organizationId: auth.organizationId },
          }))
        ) {
          throw new Error(
            'Invoice contact does not belong to the organization',
          );
        }
        const rawItems = Array.isArray(payload.items)
          ? payload.items.slice(0, 50)
          : [];
        if (!rawItems.length)
          throw new Error('At least one invoice item is required');
        const items = rawItems.map((item: any) => {
          const quantity = this.positiveNumber(
            item.quantity ?? 1,
            'Invoice item quantity',
          );
          const unitPrice = this.nonNegativeNumber(
            item.unitPrice,
            'Invoice item unit price',
          );
          const taxRate = Math.min(
            1,
            this.nonNegativeNumber(item.taxRate ?? 0, 'Invoice item tax rate'),
          );
          const line = quantity * unitPrice;
          return {
            description: this.text(
              item.description,
              'Invoice item description',
              250,
            ),
            quantity,
            unitPrice,
            taxRate,
            lineTotal: line + line * taxRate,
          };
        });
        const subtotal = items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        const taxTotal = items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice * item.taxRate,
          0,
        );
        const discountTotal = this.nonNegativeNumber(
          payload.discountTotal ?? 0,
          'Invoice discount',
        );
        if (discountTotal > subtotal + taxTotal)
          throw new Error('Invoice discount cannot exceed subtotal plus tax');
        const invoice = await this.sequelize.transaction(
          async (transaction) => {
            const created = await this.invoices.create(
              {
                organizationId: auth.organizationId,
                projectId: project?.id,
                companyId,
                contactId,
                invoiceNumber:
                  this.optionalText(payload.invoiceNumber, 100) ||
                  `INV-${Date.now()}`,
                status: 'draft',
                issueDate: this.optionalDate(payload.issueDate) || new Date(),
                dueDate: this.optionalDate(payload.dueDate) || new Date(),
                currency: this.optionalText(payload.currency, 8) || 'USD',
                subtotal,
                taxTotal,
                discountTotal,
                total: subtotal + taxTotal - discountTotal,
                amountPaid: 0,
                notes: this.optionalText(payload.notes, 4000),
              },
              { transaction },
            );
            await Promise.all(
              items.map((item, position) =>
                this.invoiceItems.create(
                  { invoiceId: created.id, ...item, position },
                  { transaction },
                ),
              ),
            );
            return created;
          },
        );
        resource = { type: 'invoice', id: invoice.id };
        data = {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: 'draft',
          total: invoice.total,
          currency: invoice.currency,
        };
        break;
      }
      case 'create_budget': {
        const name = this.text(payload.name, 'Budget name', 180);
        const periodStart =
          this.optionalDate(payload.periodStart) || new Date();
        const periodEnd = this.optionalDate(payload.periodEnd) || new Date();
        if (periodEnd < periodStart)
          throw new Error('Budget periodEnd must be on or after periodStart');
        const budget = await this.budgets.create({
          organizationId: auth.organizationId,
          projectId: project?.id,
          name,
          amount: this.positiveNumber(payload.amount, 'Budget amount'),
          currency: this.optionalText(payload.currency, 8) || 'USD',
          periodStart,
          periodEnd,
          metadata: {
            createdByAi: true,
            agentId: agent.id,
            reason: action.reason,
          },
        });
        resource = { type: 'budget', id: budget.id };
        data = {
          id: budget.id,
          name: budget.name,
          amount: budget.amount,
          currency: budget.currency,
        };
        break;
      }
      case 'create_report': {
        const report = await this.reports.create({
          organizationId: auth.organizationId,
          projectId: project?.id,
          createdById: auth.id,
          agentId: agent.id,
          title: this.text(payload.title, 'Report title', 180),
          assistant,
          status: 'generated',
          content: this.text(payload.content, 'Report content', 30000),
          format: 'markdown',
          metadata: { createdByAi: true, reason: action.reason },
        });
        resource = { type: 'report', id: report.id };
        data = {
          id: report.id,
          title: report.title,
          status: report.status,
          format: report.format,
        };
        break;
      }
      case 'create_approval': {
        const approval = await this.approvals.create({
          organizationId: auth.organizationId,
          projectId: project?.id,
          requestedByAgentId: agent.id,
          title: this.text(payload.title, 'Approval title', 180),
          type: this.optionalText(payload.type, 80) || 'ai_recommendation',
          amount:
            payload.amount === undefined
              ? undefined
              : this.nonNegativeNumber(payload.amount, 'Approval amount'),
          currency: this.optionalText(payload.currency, 8) || 'USD',
          status: 'pending',
          description: this.optionalText(payload.description, 4000),
          metadata: {
            createdByAi: true,
            reason: action.reason,
            requestedAction: payload.requestedAction || null,
          },
        });
        await this.notifications.create({
          organizationId: auth.organizationId,
          userId: auth.id,
          type: 'approval_requested',
          title: approval.title,
          body: approval.description || `Approval requested by ${agent.name}`,
          actionUrl: `/approvals/${approval.id}`,
          data: {
            resourceType: 'approval',
            resourceId: approval.id,
            agentId: agent.id,
          },
        });
        resource = { type: 'approval', id: approval.id };
        data = {
          id: approval.id,
          title: approval.title,
          status: approval.status,
        };
        break;
      }
      case 'create_crm_activity': {
        const contactId = this.optionalInteger(payload.contactId);
        const companyId = this.optionalInteger(payload.companyId);
        const dealId = this.optionalInteger(payload.dealId);
        if (
          contactId &&
          !(await this.contacts.findOne({
            where: { id: contactId, organizationId: auth.organizationId },
          }))
        ) {
          throw new Error('CRM contact does not belong to the organization');
        }
        if (
          companyId &&
          !(await this.companies.findOne({
            where: { id: companyId, organizationId: auth.organizationId },
          }))
        ) {
          throw new Error('CRM company does not belong to the organization');
        }
        if (
          dealId &&
          !(await this.deals.findOne({
            where: { id: dealId, organizationId: auth.organizationId },
          }))
        ) {
          throw new Error('CRM deal does not belong to the organization');
        }
        const activity = await this.crmActivities.create({
          organizationId: auth.organizationId,
          userId: auth.id,
          contactId,
          companyId,
          dealId,
          type: this.optionalText(payload.type, 50) || 'note',
          subject: this.text(payload.subject, 'CRM activity subject', 180),
          body: this.optionalText(payload.body, 4000),
          occurredAt: this.optionalDate(payload.occurredAt) || new Date(),
          metadata: {
            createdByAi: true,
            agentId: agent.id,
            reason: action.reason,
          },
        });
        resource = { type: 'crm_activity', id: activity.id };
        data = {
          id: activity.id,
          type: activity.type,
          subject: activity.subject,
        };
        break;
      }
      default:
        throw new Error('Unsupported action');
    }

    await this.auditLogs.create({
      organizationId: auth.organizationId,
      actorId: auth.id,
      action: `ai.${action.type}`,
      entityType: resource.type,
      entityId: resource.id,
      after: data,
      metadata: {
        agentId: agent.id,
        projectId: project?.id || null,
        reason: action.reason,
      },
    });
    return {
      type: action.type,
      status: 'executed',
      reason: action.reason,
      resource,
      data,
    };
  }

  private parsePayload(payload: string): any {
    try {
      const value = JSON.parse(payload || '{}');
      if (!value || Array.isArray(value) || typeof value !== 'object')
        throw new Error();
      return value;
    } catch {
      throw new Error('Action payload must be a valid JSON object');
    }
  }

  private text(value: unknown, label: string, max: number): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) throw new Error(`${label} is required`);
    return normalized.slice(0, max);
  }

  private optionalText(value: unknown, max: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value).trim().slice(0, max) || undefined;
  }

  private optionalInteger(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0)
      throw new Error('Referenced IDs must be positive integers');
    return parsed;
  }

  private nonNegativeNumber(value: unknown, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
      throw new Error(`${label} must be a non-negative number`);
    return parsed;
  }

  private positiveNumber(value: unknown, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
      throw new Error(`${label} must be greater than zero`);
    return parsed;
  }

  private optionalDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime()))
      throw new Error('Action contains an invalid date');
    return parsed;
  }

  private oneOf(value: unknown, allowed: string[], fallback: string): string {
    return allowed.includes(String(value)) ? String(value) : fallback;
  }
}
