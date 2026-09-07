import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
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
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Project,
      Task,
      Deal,
      Transaction,
      Expense,
      Invoice,
      AiMessage,
      AutomationRun,
      Organization,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
