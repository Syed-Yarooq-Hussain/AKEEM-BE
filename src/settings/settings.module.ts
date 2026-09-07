import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Membership,
  Organization,
  OrganizationInvitation,
  Role,
  User,
} from '../../models';
import { EmailModule } from '../email/email.module';
import {
  OrganizationController,
  UserSettingsController,
} from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Membership,
      Organization,
      OrganizationInvitation,
      Role,
      User,
    ]),
    EmailModule,
  ],
  controllers: [OrganizationController, UserSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
