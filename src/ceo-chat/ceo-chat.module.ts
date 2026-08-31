import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiAgent, AiConversation, AiMessage, Company, Deal, Expense, Invoice, Project, Task } from '../../models';
import { CeoChatController } from './ceo-chat.controller';
import { CeoChatService } from './ceo-chat.service';

@Module({
  imports: [SequelizeModule.forFeature([Project, Task, Deal, Company, Invoice, Expense, AiAgent, AiConversation, AiMessage])],
  controllers: [CeoChatController], providers: [CeoChatService],
})
export class CeoChatModule {}
