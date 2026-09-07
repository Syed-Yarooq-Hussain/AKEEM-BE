import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Automation, AutomationRun, Project } from '../../models';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
@Module({
  imports: [SequelizeModule.forFeature([Automation, AutomationRun, Project])],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}
