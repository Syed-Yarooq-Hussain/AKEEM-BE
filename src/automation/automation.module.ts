import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Approval,
  AuditLog,
  Automation,
  AutomationRun,
  Budget,
  CrmActivity,
  Project,
  Report,
  Task,
} from '../../models';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Automation,
      AutomationRun,
      Project,
      Task,
      Report,
      Approval,
      Budget,
      CrmActivity,
      AuditLog,
    ]),
  ],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
