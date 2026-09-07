import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Budget,
  Expense,
  FinancialAccount,
  Invoice,
  InvoiceItem,
  Organization,
  Payment,
  Project,
  Transaction,
  TransactionCategory,
} from '../../models';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Budget,
      Expense,
      FinancialAccount,
      Invoice,
      InvoiceItem,
      Organization,
      Payment,
      Project,
      Transaction,
      TransactionCategory,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
