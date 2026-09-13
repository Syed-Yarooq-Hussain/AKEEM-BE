import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiAgent,
  AiAgentDelegation,
  AiAgentTeam,
  AiAgentTeamMember,
  AiConversation,
  AiMessage,
  Approval,
  AuditLog,
  Budget,
  Company,
  Contact,
  CrmActivity,
  Deal,
  Expense,
  Invoice,
  InvoiceItem,
  Notification,
  Organization,
  Project,
  Report,
  Task,
  Transaction,
} from '../../models';
import { AgentActionService } from './agent-action.service';
import { AssistantController } from './assistant.controller';
import { CeoChatController } from './ceo-chat.controller';
import { CeoChatService } from './ceo-chat.service';
import { OrchestratorController } from './orchestrator.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    FilesModule,
    SequelizeModule.forFeature([
      Organization,
      Project,
      Task,
      Deal,
      Company,
      Contact,
      CrmActivity,
      Invoice,
      InvoiceItem,
      Expense,
      Transaction,
      Budget,
      Approval,
      Report,
      Notification,
      AuditLog,
      AiAgent,
      AiAgentTeam,
      AiAgentTeamMember,
      AiAgentDelegation,
      AiConversation,
      AiMessage,
    ]),
  ],
  controllers: [OrchestratorController, CeoChatController, AssistantController],
  providers: [CeoChatService, AgentActionService],
  exports: [CeoChatService],
})
export class CeoChatModule {}
