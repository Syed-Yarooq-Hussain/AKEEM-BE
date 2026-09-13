import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiAgent,
  Approval,
  AuditLog,
  Membership,
  Project,
  Role,
  User,
} from '../../models';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Approval,
      Project,
      User,
      AiAgent,
      Membership,
      Role,
      AuditLog,
    ]),
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}
