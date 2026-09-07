import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
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
  ) {}

  async overview(
    auth: { organizationId: number },
    projectId?: number,
    period = '6m',
  ) {
    if (
      projectId &&
      !(await this.projects.findOne({
        where: { id: projectId, organizationId: auth.organizationId },
      }))
    )
      throw new NotFoundException('Project not found in your organization');
    const projectWhere = projectId ? { projectId } : {};
    const since = this.since(period);
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
        where: { organizationId: auth.organizationId, status: 'open' },
      }),
      this.deals.count({
        where: {
          organizationId: auth.organizationId,
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
        where: { role: 'assistant', createdAt: { [Op.gte]: since } },
      }),
      this.runs.count({
        where: {
          organizationId: auth.organizationId,
          status: 'completed',
          createdAt: { [Op.gte]: since },
        },
      }),
    ]);
    const rev = Number(revenue || 0),
      exp = Number(expenseValue || 0);
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
      chart: [
        {
          period: new Date().toISOString().slice(0, 7),
          revenue: rev,
          expenses: exp,
        },
      ],
      aiActivity: [],
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
