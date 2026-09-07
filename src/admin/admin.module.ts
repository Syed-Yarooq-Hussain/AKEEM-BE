import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiConversation,
  AiMessage,
  AuditLog,
  Integration,
  Membership,
  Role,
  User,
} from '../../models';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CredentialEncryptionService } from './credential-encryption.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      AiConversation,
      AiMessage,
      AuditLog,
      Integration,
      Membership,
      Role,
      User,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, CredentialEncryptionService],
})
export class AdminModule {}
