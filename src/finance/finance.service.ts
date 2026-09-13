import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  Budget,
  Expense,
  FinancialAccount,
  Invoice,
  InvoiceItem,
  Organization,
  Project,
  Transaction,
} from '../../models';
@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Budget) private budget: typeof Budget,
    @InjectModel(Expense) private expense: typeof Expense,
    @InjectModel(FinancialAccount) private account: typeof FinancialAccount,
    @InjectModel(Invoice) private invoice: typeof Invoice,
    @InjectModel(InvoiceItem) private items: typeof InvoiceItem,
    @InjectModel(Organization) private org: typeof Organization,
    @InjectModel(Project) private projects: typeof Project,
    @InjectModel(Transaction) private transaction: typeof Transaction,
  ) {}
  async project(a: any, id?: number) {
    if (
      id &&
      !(await this.projects.findOne({
        where: { id, organizationId: a.organizationId },
      }))
    )
      throw new NotFoundException('Project not found in your organization');
  }
  page(q: any) {
    const page = Math.max(1, Number(q.page) || 1),
      limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    return { page, limit, offset: (page - 1) * limit };
  }
  async overview(a: any, projectId?: number, period = 'month') {
    await this.project(a, projectId);
    const w: any = {
      organizationId: a.organizationId,
      ...(projectId ? { projectId } : {}),
    };
    const [revenue, expenses, cashRows, currency] = await Promise.all([
      this.invoice.sum('amountPaid', { where: w }),
      this.expense.sum('amount', {
        where: { ...w, status: { [Op.notIn]: ['rejected', 'cancelled'] } },
      }),
      this.transaction.findAll({
        where: { ...w, status: 'cleared' },
        attributes: ['type', 'amount'],
      }),
      this.org.findByPk(a.organizationId),
    ]);
    const r = Number(revenue || 0),
      e = Number(expenses || 0);
    const cash = cashRows.reduce(
      (total, row) =>
        total +
        (row.type === 'expense'
          ? -Number(row.amount || 0)
          : Number(row.amount || 0)),
      0,
    );
    return {
      period,
      revenue: r,
      expenses: e,
      profit: r - e,
      cashBalance: cash,
      currency: currency?.currency || 'USD',
      monthlyTrend: [
        {
          period: new Date().toISOString().slice(0, 7),
          revenue: r,
          expenses: e,
        },
      ],
    };
  }
  async transactions(a: any, q: any) {
    await this.project(a, q.projectId ? Number(q.projectId) : undefined);
    const p = this.page(q),
      w: any = { organizationId: a.organizationId };
    if (q.projectId) w.projectId = Number(q.projectId);
    if (q.type) w.type = q.type;
    const { rows, count } = await this.transaction.findAndCountAll({
      where: w,
      limit: p.limit,
      offset: p.offset,
      order: [['transactionDate', 'DESC']],
    });
    return {
      items: rows,
      pagination: {
        page: p.page,
        limit: p.limit,
        total: count,
        totalPages: Math.ceil(count / p.limit),
      },
    };
  }
  async createTransaction(a: any, b: any) {
    if (!b.type || b.amount === undefined)
      throw new UnprocessableEntityException('type and amount are required');
    await this.project(a, b.projectId);
    let accountId = b.accountId;
    if (!accountId) {
      const [x] = await this.account.findOrCreate({
        where: { organizationId: a.organizationId, name: 'Primary Cash' },
        defaults: {
          organizationId: a.organizationId,
          name: 'Primary Cash',
          type: 'cash',
          currency: b.currency || 'USD',
          openingBalance: 0,
          isActive: true,
        },
      });
      accountId = x.id;
    }
    return this.transaction.create({
      organizationId: a.organizationId,
      accountId,
      projectId: b.projectId,
      categoryId: b.categoryId,
      companyId: b.companyId,
      type: b.type,
      amount: b.amount,
      currency: b.currency || 'USD',
      transactionDate: b.transactionDate
        ? new Date(b.transactionDate)
        : new Date(),
      description: b.description,
      reference: b.reference,
      status: b.status || 'cleared',
      metadata: b.metadata || {},
    });
  }
  async invoices(a: any, q: any) {
    await this.project(a, q.projectId ? Number(q.projectId) : undefined);
    const p = this.page(q),
      w: any = { organizationId: a.organizationId };
    if (q.projectId) w.projectId = Number(q.projectId);
    if (q.status) w.status = q.status;
    const { rows, count } = await this.invoice.findAndCountAll({
      where: w,
      include: [InvoiceItem],
      distinct: true,
      limit: p.limit,
      offset: p.offset,
      order: [['createdAt', 'DESC']],
    });
    return {
      items: rows,
      pagination: {
        page: p.page,
        limit: p.limit,
        total: count,
        totalPages: Math.ceil(count / p.limit),
      },
    };
  }
  async createInvoice(a: any, b: any) {
    await this.project(a, b.projectId);
    const lines = Array.isArray(b.items) ? b.items : [];
    const subtotal = lines.reduce(
      (s, x) => s + Number(x.quantity || 1) * Number(x.unitPrice || 0),
      0,
    );
    const tax = lines.reduce(
      (s, x) =>
        s +
        Number(x.quantity || 1) *
          Number(x.unitPrice || 0) *
          Number(x.taxRate || 0),
      0,
    );
    const inv = await this.invoice.create({
      organizationId: a.organizationId,
      projectId: b.projectId,
      companyId: b.companyId,
      contactId: b.contactId,
      invoiceNumber: b.invoiceNumber || `INV-${Date.now()}`,
      status: b.status || 'draft',
      issueDate: b.issueDate ? new Date(b.issueDate) : new Date(),
      dueDate: b.dueDate ? new Date(b.dueDate) : new Date(),
      currency: b.currency || 'USD',
      subtotal,
      taxTotal: tax,
      discountTotal: Number(b.discountTotal || 0),
      total: subtotal + tax - Number(b.discountTotal || 0),
      amountPaid: 0,
      notes: b.notes,
    });
    for (let i = 0; i < lines.length; i++) {
      const x = lines[i],
        line = Number(x.quantity || 1) * Number(x.unitPrice || 0);
      await this.items.create({
        invoiceId: inv.id,
        description: x.description,
        quantity: x.quantity || 1,
        unitPrice: x.unitPrice || 0,
        taxRate: x.taxRate || 0,
        lineTotal: line + line * Number(x.taxRate || 0),
        position: i,
      });
    }
    return this.invoice.findByPk(inv.id, { include: [InvoiceItem] });
  }
  async updateInvoice(a: any, id: number, b: any) {
    const x = await this.invoice.findOne({
      where: { id, organizationId: a.organizationId },
    });
    if (!x) throw new NotFoundException('Invoice not found');
    if (b.projectId) await this.project(a, Number(b.projectId));
    const editable = [
      'projectId',
      'status',
      'issueDate',
      'dueDate',
      'notes',
      'amountPaid',
      'paidAt',
    ];
    const update = Object.fromEntries(
      editable
        .filter((key) => b[key] !== undefined)
        .map((key) => [key, b[key]]),
    );
    if (
      b.amountPaid !== undefined &&
      (!Number.isFinite(Number(b.amountPaid)) ||
        Number(b.amountPaid) < 0 ||
        Number(b.amountPaid) > Number(x.total))
    )
      throw new UnprocessableEntityException(
        'amountPaid must be between zero and the invoice total',
      );
    return x.update(update);
  }
  async budgets(a: any, q: any) {
    await this.project(a, q.projectId ? Number(q.projectId) : undefined);
    return this.budget.findAll({
      where: {
        organizationId: a.organizationId,
        ...(q.projectId ? { projectId: Number(q.projectId) } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
  }
  async createBudget(a: any, b: any) {
    if (!b.name || b.amount === undefined)
      throw new UnprocessableEntityException('name and amount are required');
    await this.project(a, b.projectId);
    return this.budget.create({
      organizationId: a.organizationId,
      projectId: b.projectId,
      categoryId: b.categoryId,
      name: b.name,
      amount: b.amount,
      currency: b.currency || 'USD',
      periodStart: b.periodStart ? new Date(b.periodStart) : new Date(),
      periodEnd: b.periodEnd ? new Date(b.periodEnd) : new Date(),
      metadata: b.metadata || {},
    });
  }
  async cashFlow(a: any, q: any) {
    const data = await this.overview(
      a,
      q.projectId ? Number(q.projectId) : undefined,
      q.period,
    );
    return {
      openingBalance: 0,
      inflows: data.revenue,
      outflows: data.expenses,
      netCashFlow: data.profit,
      closingBalance: data.cashBalance,
      currency: data.currency,
      trend: data.monthlyTrend,
    };
  }
  async financeReport(a: any, q: any) {
    const overview = await this.overview(
      a,
      q.projectId ? Number(q.projectId) : undefined,
      q.period,
    );
    return { type: 'profit-loss', generatedAt: new Date(), ...overview };
  }
}
