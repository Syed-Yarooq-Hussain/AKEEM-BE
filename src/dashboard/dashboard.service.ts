import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  AiConversation,
  Automation,
  AiMessage,
  AutomationRun,
  Deal,
  Expense,
  Invoice,
  Organization,
  Project,
  Task,
  Transaction,
} from '../../models';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project) private projects: typeof Project,
    @InjectModel(Task) private tasks: typeof Task,
    @InjectModel(Deal) private deals: typeof Deal,
    @InjectModel(Transaction) private transactions: typeof Transaction,
    @InjectModel(Expense) private expenses: typeof Expense,
    @InjectModel(Invoice) private invoices: typeof Invoice,
    @InjectModel(AiMessage) private aiMessages: typeof AiMessage,
    @InjectModel(AutomationRun) private runs: typeof AutomationRun,
    @InjectModel(Organization) private organizations: typeof Organization,
    @InjectModel(AiConversation) private conversations: typeof AiConversation,
    @InjectModel(Automation) private automations: typeof Automation,
  ) {}

  async overview(
    auth: { organizationId: number },
    projectId?: number,
    period = '6m',
  ) {
    const project = projectId
      ? await this.projects.findOne({
          where: { id: projectId, organizationId: auth.organizationId },
        })
      : null;
    if (projectId && !project)
      throw new NotFoundException('Project not found in your organization');
    const projectWhere = projectId ? { projectId } : {};
    const since = this.since(period);
    const conversations = await this.conversations.findAll({
      where: {
        organizationId: auth.organizationId,
        ...(projectId ? { context: { [Op.contains]: { projectId } } } : {}),
      },
      attributes: ['id'],
    });
    const messageWhere = {
      conversationId: { [Op.in]: conversations.map((item) => item.id) },
      role: 'assistant',
      createdAt: { [Op.gte]: since },
    };
    const automations = projectId
      ? await this.automations.findAll({
          where: { organizationId: auth.organizationId, projectId },
          attributes: ['id'],
        })
      : [];
    const dealWhere = {
      organizationId: auth.organizationId,
      ...(projectId ? { id: project?.dealId || 0 } : {}),
    };
    const [
      organization,
      revenue,
      expenseValue,
      activeDeals,
      newDeals,
      pendingTasks,
      highPriority,
      aiMessages,
      automationRuns,
      recentMessages,
      invoiceRows,
      expenseRows,
    ] = await Promise.all([
      this.organizations.findByPk(auth.organizationId),
      this.invoices.sum('amountPaid', {
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          paidAt: { [Op.gte]: since },
        },
      }),
      this.expenses.sum('amount', {
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          expenseDate: { [Op.gte]: since },
          status: { [Op.notIn]: ['rejected', 'cancelled'] },
        },
      }),
      this.deals.count({
        where: { ...dealWhere, status: 'open' },
      }),
      this.deals.count({
        where: {
          ...dealWhere,
          createdAt: { [Op.gte]: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      this.tasks.count({
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          status: { [Op.notIn]: ['done', 'cancelled'] },
        },
      }),
      this.tasks.count({
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          priority: 'high',
          status: { [Op.notIn]: ['done', 'cancelled'] },
        },
      }),
      this.aiMessages.count({
        where: messageWhere,
      }),
      this.runs.count({
        where: {
          organizationId: auth.organizationId,
          ...(projectId
            ? { automationId: { [Op.in]: automations.map((item) => item.id) } }
            : {}),
          status: 'completed',
          createdAt: { [Op.gte]: since },
        },
      }),
      this.aiMessages.findAll({
        where: messageWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
      }),
      this.invoices.findAll({
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          paidAt: { [Op.gte]: since },
        },
        attributes: ['paidAt', 'amountPaid'],
      }),
      this.expenses.findAll({
        where: {
          organizationId: auth.organizationId,
          ...projectWhere,
          expenseDate: { [Op.gte]: since },
          status: { [Op.notIn]: ['rejected', 'cancelled'] },
        },
        attributes: ['expenseDate', 'amount'],
      }),
    ]);
    const rev = Number(revenue || 0),
      exp = Number(expenseValue || 0);
    const buckets = new Map<
      string,
      { period: string; revenue: number; expenses: number }
    >();
    const cursor = new Date(
      Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1),
    );
    while (cursor <= new Date()) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.set(key, { period: key, revenue: 0, expenses: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (const row of invoiceRows) {
      const bucket = buckets.get(
        new Date(row.paidAt).toISOString().slice(0, 7),
      );
      if (bucket) bucket.revenue += Number(row.amountPaid || 0);
    }
    for (const row of expenseRows) {
      const bucket = buckets.get(
        new Date(row.expenseDate).toISOString().slice(0, 7),
      );
      if (bucket) bucket.expenses += Number(row.amount || 0);
    }
    return {
      metrics: {
        revenue: {
          value: rev,
          currency: organization?.currency || 'USD',
          changePercent: 0,
        },
        activeDeals: { value: activeDeals, newThisWeek: newDeals },
        pendingTasks: { value: pendingTasks, highPriority },
        aiHoursSaved: {
          value:
            Math.round((aiMessages * 0.1 + automationRuns * 0.5) * 10) / 10,
          changePercent: 0,
        },
      },
      chart: [...buckets.values()],
      aiActivity: recentMessages.map((item) => ({
        id: item.id,
        assistant: (item.metadata as any)?.requestedAssistant || 'executive',
        title: item.content.slice(0, 180),
        createdAt: item.createdAt,
      })),
    };
  }

  private since(period: string) {
    const match = /^(\d+)([mdy])$/.exec(period);
    const amount = match ? Number(match[1]) : 6;
    const unit = match?.[2] || 'm';
    const date = new Date();
    if (unit === 'd') date.setDate(date.getDate() - amount);
    else if (unit === 'y') date.setFullYear(date.getFullYear() - amount);
    else date.setMonth(date.getMonth() - amount);
    return date;
  }
}
