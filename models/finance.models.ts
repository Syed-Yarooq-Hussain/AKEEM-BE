import {
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from './base.model';
import { Organization, User } from './core.models';
import { Company, Contact } from './crm.models';
import { Project } from './work.models';

@Table({ tableName: 'financial_accounts', underscored: true, paranoid: true })
export class FinancialAccount extends BaseModel<FinancialAccount> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ allowNull: false }) declare type: string;
  @Column declare institution?: string;
  @Column declare lastFour?: string;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare openingBalance: number;
  @Column({ defaultValue: true }) declare isActive: boolean;
}
@Table({
  tableName: 'transaction_categories',
  underscored: true,
  paranoid: true,
})
export class TransactionCategory extends BaseModel<TransactionCategory> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => TransactionCategory)
  @Column(DataType.INTEGER)
  declare parentId?: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ allowNull: false }) declare type: string;
  @Column declare color?: string;
}
@Table({ tableName: 'transactions', underscored: true, paranoid: true })
export class Transaction extends BaseModel<Transaction> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => FinancialAccount)
  @Column(DataType.INTEGER)
  declare accountId: number;
  @ForeignKey(() => TransactionCategory)
  @Column(DataType.INTEGER)
  declare categoryId?: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => Project)
  @Column(DataType.INTEGER)
  declare projectId?: number;
  @Column({ allowNull: false }) declare type: string;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare amount: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column({ allowNull: false }) declare transactionDate: Date;
  @Column declare description?: string;
  @Column declare reference?: string;
  @Column({ defaultValue: 'cleared' }) declare status: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
@Table({ tableName: 'invoices', underscored: true, paranoid: true })
export class Invoice extends BaseModel<Invoice> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => Contact)
  @Column(DataType.INTEGER)
  declare contactId?: number;
  @ForeignKey(() => Project)
  @Column(DataType.INTEGER)
  declare projectId?: number;
  @Column({ allowNull: false }) declare invoiceNumber: string;
  @Column({ defaultValue: 'draft' }) declare status: string;
  @Column declare issueDate: Date;
  @Column declare dueDate: Date;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare subtotal: number;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare taxTotal: number;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare discountTotal: number;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare total: number;
  @Column({ type: DataType.DECIMAL(16, 2), defaultValue: 0 })
  declare amountPaid: number;
  @Column({ type: DataType.TEXT }) declare notes?: string;
  @Column declare sentAt?: Date;
  @Column declare paidAt?: Date;
  @HasMany(() => InvoiceItem) declare items: InvoiceItem[];
}
@Table({ tableName: 'invoice_items', underscored: true, paranoid: true })
export class InvoiceItem extends BaseModel<InvoiceItem> {
  @ForeignKey(() => Invoice)
  @Column(DataType.INTEGER)
  declare invoiceId: number;
  @Column({ allowNull: false }) declare description: string;
  @Column({ type: DataType.DECIMAL(12, 3), defaultValue: 1 })
  declare quantity: number;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare unitPrice: number;
  @Column({ type: DataType.DECIMAL(7, 4), defaultValue: 0 })
  declare taxRate: number;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare lineTotal: number;
  @Column({ defaultValue: 0 }) declare position: number;
}
@Table({ tableName: 'payments', underscored: true, paranoid: true })
export class Payment extends BaseModel<Payment> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Invoice)
  @Column(DataType.INTEGER)
  declare invoiceId?: number;
  @ForeignKey(() => FinancialAccount)
  @Column(DataType.INTEGER)
  declare accountId?: number;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare amount: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column declare paidAt: Date;
  @Column declare method?: string;
  @Column declare reference?: string;
  @Column({ defaultValue: 'completed' }) declare status: string;
}
@Table({ tableName: 'expenses', underscored: true, paranoid: true })
export class Expense extends BaseModel<Expense> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare submittedById: number;
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare approvedById?: number;
  @ForeignKey(() => TransactionCategory)
  @Column(DataType.INTEGER)
  declare categoryId?: number;
  @ForeignKey(() => Project)
  @Column(DataType.INTEGER)
  declare projectId?: number;
  @Column({ allowNull: false }) declare merchant: string;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare amount: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column declare expenseDate: Date;
  @Column({ defaultValue: 'pending' }) declare status: string;
  @Column declare receiptUrl?: string;
  @Column({ type: DataType.TEXT }) declare note?: string;
}

@Table({ tableName: 'budgets', underscored: true, paranoid: true })
export class Budget extends BaseModel<Budget> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Project)
  @Column(DataType.INTEGER)
  declare projectId?: number;
  @ForeignKey(() => TransactionCategory)
  @Column(DataType.INTEGER)
  declare categoryId?: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ type: DataType.DECIMAL(16, 2), allowNull: false })
  declare amount: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column declare periodStart: Date;
  @Column declare periodEnd: Date;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
