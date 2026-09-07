import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiAgent, Approval, Project, User } from '../../models';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
@Module({
  imports: [SequelizeModule.forFeature([Approval, Project, User, AiAgent])],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}
