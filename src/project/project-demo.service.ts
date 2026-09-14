import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import {
  Approval,
  Budget,
  Company,
  Contact,
  Deal,
  Expense,
  FinancialAccount,
  Invoice,
  InvoiceItem,
  Organization,
  Payment,
  Pipeline,
  PipelineStage,
  Project,
  Report,
  Task,
  TaskAssignee,
  Transaction,
  Membership,
  Role,
  User,
} from '../../models';

@Injectable()
export class ProjectDemoService {
  constructor(@InjectConnection() private readonly database: Sequelize) {}

  async seedPublic(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new NotFoundException('Project not found');
    }
    const project = await Project.findByPk(id);
    if (!project || project.status === 'archived') {
      throw new NotFoundException('Public demo project is unavailable');
    }
    const membership = await Membership.findOne({
      where: { organizationId: project.organizationId, status: 'active' },
      include: [
        {
          model: Role,
          required: true,
          where: {
            organizationId: project.organizationId,
            name: { [Op.in]: ['Owner', 'Admin'] },
          },
        },
        { model: User, required: true, where: { status: 'active' } },
      ],
      order: [['id', 'ASC']],
    });
    if (!membership)
      throw new ForbiddenException(
        'Demo organization requires an active Owner or Admin',
      );
    const result = await this.seed(
      {
        id: membership.userId,
        organizationId: project.organizationId,
        role: membership.role.name,
      },
      id,
    );
    // Public callers receive no organization records or stored scenario details.
    return {
      projectId: id,
      alreadySeeded: result.alreadySeeded,
      message: result.alreadySeeded
        ? 'Demo data already exists. Sign in to analyze this project.'
        : 'Demo data created. Sign in and select this project to analyze it.',
    };
  }

  async seed(
    auth: { id: number; organizationId: number; role?: string },
    id: number,
  ) {
    if (!['owner', 'admin'].includes(String(auth.role).toLowerCase())) {
      throw new ForbiddenException(
        'Only an organization Owner or Admin can insert demo data',
      );
    }
    return this.database.transaction(async (transaction) => {
      const project = await Project.findOne({
        where: { id, organizationId: auth.organizationId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!project)
        throw new NotFoundException('Project not found in your organization');
      const settings = (project.settings || {}) as Record<string, any>;
      if (settings.demoDataSeed)
        return { ...settings.demoDataSeed, alreadySeeded: true };

      const organization = await Organization.findByPk(auth.organizationId, {
        transaction,
      });
      const currency = organization?.currency || 'EUR';
      const day = (offset: number) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + offset);
        return date;
      };
      const options = { transaction };
      const tenant = { organizationId: auth.organizationId };
      const scoped = { ...tenant, projectId: id };
      const metadata = { demo: true, demoProjectId: id };
      const ids: Record<string, number[]> = {};
      const keep = (type: string, row: { id: number }) => {
        (ids[type] ||= []).push(row.id);
        return row;
      };

      const companyId =
        project.companyId ||
        keep(
          'companies',
          await Company.create(
            {
              ...tenant,
              name: `[DEMO P${id}] Northstar Retail`,
              industry: 'Retail',
              domain: `demo-project-${id}.example`,
              tags: ['demo'],
              customFields: metadata,
            },
            options,
          ),
        ).id;
      const contactId =
        project.contactId ||
        keep(
          'contacts',
          await Contact.create(
            {
              ...tenant,
              companyId,
              ownerId: auth.id,
              firstName: 'Demo',
              lastName: 'Customer',
              email: `project-${id}@example.invalid`,
              lifecycleStage: 'customer',
              tags: ['demo'],
              customFields: metadata,
            },
            options,
          ),
        ).id;
      let dealId = project.dealId;
      if (!dealId) {
        const pipeline = keep(
          'pipelines',
          await Pipeline.create(
            { ...tenant, name: `[DEMO P${id}] Sales`, isDefault: false },
            options,
          ),
        );
        let proposalId: number;
        for (const [position, name] of [
          'Lead',
          'Qualified',
          'Proposal',
          'Won',
          'Lost',
        ].entries()) {
          const stage = keep(
            'stages',
            await PipelineStage.create(
              {
                pipelineId: pipeline.id,
                name,
                position,
                probability: [10, 30, 60, 100, 0][position],
              },
              options,
            ),
          );
          if (name === 'Proposal') proposalId = stage.id;
        }
        dealId = keep(
          'deals',
          await Deal.create(
            {
              ...tenant,
              companyId,
              contactId,
              ownerId: auth.id,
              pipelineId: pipeline.id,
              stageId: proposalId!,
              title: `[DEMO P${id}] Customer expansion`,
              value: 30000,
              currency,
              status: 'open',
              expectedCloseDate: day(14),
            },
            options,
          ),
        ).id;
      }
      const account = keep(
        'accounts',
        await FinancialAccount.create(
          {
            ...tenant,
            name: `[DEMO P${id}] Cash account`,
            type: 'bank',
            currency,
            openingBalance: 0,
          },
          options,
        ),
      );
      keep(
        'budgets',
        await Budget.create(
          {
            ...scoped,
            name: `[DEMO P${id}] Launch budget`,
            amount: 20000,
            currency,
            periodStart: day(-14),
            periodEnd: day(30),
            metadata,
          },
          options,
        ),
      );

      for (const [index, total, paid] of [
        [1, 15000, 15000],
        [2, 10000, 0],
      ]) {
        const invoice = keep(
          'invoices',
          await Invoice.create(
            {
              ...scoped,
              companyId,
              contactId,
              invoiceNumber: `DEMO-P${id}-${index}`,
              status: paid ? 'paid' : 'sent',
              issueDate: day(-10),
              dueDate: day(-3),
              subtotal: total,
              total,
              amountPaid: paid,
              taxTotal: 0,
              discountTotal: 0,
              currency,
              notes: 'Synthetic demo invoice; do not send to a real customer.',
              ...(paid ? { paidAt: day(-5) } : {}),
            },
            options,
          ),
        );
        keep(
          'invoiceItems',
          await InvoiceItem.create(
            {
              invoiceId: invoice.id,
              description: '[DEMO] Project delivery services',
              quantity: 1,
              unitPrice: total,
              taxRate: 0,
              lineTotal: total,
            },
            options,
          ),
        );
        if (paid) {
          keep(
            'payments',
            await Payment.create(
              {
                ...tenant,
                invoiceId: invoice.id,
                accountId: account.id,
                amount: paid,
                currency,
                paidAt: day(-5),
                method: 'demo',
                reference: `DEMO-P${id}`,
                status: 'completed',
              },
              options,
            ),
          );
          keep(
            'transactions',
            await Transaction.create(
              {
                ...scoped,
                accountId: account.id,
                companyId,
                type: 'income',
                amount: paid,
                currency,
                transactionDate: day(-5),
                description: '[DEMO] Receipt for paid invoice',
                status: 'cleared',
                metadata,
              },
              options,
            ),
          );
        }
      }
      for (const [merchant, amount] of [
        ['Design', 3000],
        ['Development', 6000],
        ['Marketing', 2000],
      ] as const) {
        keep(
          'expenses',
          await Expense.create(
            {
              ...scoped,
              submittedById: auth.id,
              approvedById: auth.id,
              merchant: `[DEMO] ${merchant}`,
              amount,
              currency,
              expenseDate: day(-2),
              status: 'approved',
              note: 'Synthetic demo spending; transaction is the cash representation of this same expense.',
            },
            options,
          ),
        );
        keep(
          'transactions',
          await Transaction.create(
            {
              ...scoped,
              accountId: account.id,
              type: 'expense',
              amount,
              currency,
              transactionDate: day(-2),
              description: `[DEMO] ${merchant} expense payment`,
              status: 'cleared',
              metadata,
            },
            options,
          ),
        );
      }
      const tasks = [
        ['Complete design', 'done', 'medium', -7],
        ['Obtain missing payment sandbox credentials', 'todo', 'urgent', -2],
        ['Finish development integration', 'in_progress', 'high', 7],
        [
          'Approve campaign brief: target 100 qualified leads',
          'todo',
          'medium',
          5,
        ],
        [
          'Review privacy notice and customer terms before launch',
          'todo',
          'high',
          10,
        ],
        ['Contact at-risk customer about onboarding delay', 'todo', 'high', -1],
        [
          'Run ten-day acceptance testing after integration',
          'todo',
          'high',
          21,
        ],
        ['Assign backup release-day support owner', 'todo', 'medium', 14],
      ] as const;
      for (const [title, status, priority, due] of tasks) {
        const task = keep(
          'tasks',
          await Task.create(
            {
              ...scoped,
              createdById: auth.id,
              title: `[DEMO] ${title}`,
              description: 'Synthetic launch scenario for agent analysis.',
              status,
              priority,
              dueAt: day(due),
              ...(status === 'done' ? { completedAt: day(-7) } : {}),
            },
            options,
          ),
        );
        keep(
          'taskAssignees',
          await TaskAssignee.create(
            { taskId: task.id, userId: auth.id },
            options,
          ),
        );
      }
      for (const [title, type, amount] of [
        [
          'Budget increase: forecast cost 22000 vs approved 20000',
          'budget',
          2000,
        ],
        ['Privacy notice and customer terms need review', 'contract', 0],
      ] as const) {
        keep(
          'approvals',
          await Approval.create(
            {
              ...scoped,
              requestedByUserId: auth.id,
              title: `[DEMO] ${title}`,
              type,
              amount,
              currency,
              status: 'pending',
              description:
                'Synthetic demo request; no external action requested.',
              metadata,
            },
            options,
          ),
        );
      }
      const scenario = {
        synthetic: true,
        budget: 20000,
        spending: 11000,
        remainingBudget: 9000,
        forecastAdditionalCost: 11000,
        forecastFinalCost: 22000,
        forecastOverrun: 2000,
        invoiced: 25000,
        received: 15000,
        outstanding: 10000,
        cashBalance: 4000,
        marketing:
          'Campaign target is 100 qualified leads; actual campaign results are not yet available.',
        legal:
          'Privacy notice and customer terms need review; do not infer legal approval.',
        customerSuccess:
          'Customer onboarding is delayed by missing payment integration credentials.',
        accounting:
          'Expenses and expense transactions represent the same spending, not additional costs. Open sales deal is a forecast, not recognized revenue.',
      };
      keep(
        'reports',
        await Report.create(
          {
            ...scoped,
            createdById: auth.id,
            title: `[DEMO P${id}] Launch baseline`,
            assistant: 'executive',
            format: 'markdown',
            status: 'generated',
            content: `# Synthetic demo baseline\n\n${JSON.stringify(scenario, null, 2)}`,
            metadata,
          },
          options,
        ),
      );
      const result = {
        projectId: id,
        currency,
        seededAt: new Date().toISOString(),
        alreadySeeded: false,
        createdCounts: Object.fromEntries(
          Object.entries(ids).map(([type, values]) => [type, values.length]),
        ),
        ids,
        scenario,
        suggestedPrompt:
          'Is project ke demo records se budget, cash flow, overdue tasks, sales risk aur top 5 next steps Roman Urdu mein batao. Koi action execute mat karo.',
      };
      await project.update(
        {
          companyId,
          contactId,
          dealId,
          settings: { ...settings, demoDataSeed: result },
        },
        options,
      );
      return result;
    });
  }
}
