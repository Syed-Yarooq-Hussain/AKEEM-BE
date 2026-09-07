import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiTask, Project } from '../../models';
import { CeoChatModule } from '../ceo-chat/ceo-chat.module';
import { AiTaskController } from './ai-task.controller';
import { AiTaskService } from './ai-task.service';

@Module({
  imports: [SequelizeModule.forFeature([AiTask, Project]), CeoChatModule],
  controllers: [AiTaskController],
  providers: [AiTaskService],
})
export class AiTaskModule {}
