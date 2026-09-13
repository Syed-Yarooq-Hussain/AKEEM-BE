import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SAAS_MODELS } from '../models';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { CeoChatModule } from './ceo-chat/ceo-chat.module';
import { ProjectModule } from './project/project.module';
import { ApiResponseInterceptor } from './common/api-response.interceptor';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiTaskModule } from './ai-task/ai-task.module';
import { NotificationModule } from './notification/notification.module';
import { ApprovalModule } from './approval/approval.module';
import { AutomationModule } from './automation/automation.module';
import { CrmModule } from './crm/crm.module';
import { FinanceModule } from './finance/finance.module';
import { FilesModule } from './files/files.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { databaseConfig } from './config/database.config';
import { RequestTimeoutInterceptor } from './common/request-timeout.interceptor';
import { HealthModule } from './health/health.module';

dotenv.config();

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_MS || 60_000),
        limit: Number(process.env.RATE_LIMIT_MAX || 120),
      },
    ]),
    SequelizeModule.forRoot({
      ...databaseConfig(),
      models: SAAS_MODELS,
      autoLoadModels: false,
    }),
    AuthModule,
    PassportModule,
    ProjectModule,
    DashboardModule,
    AiTaskModule,
    NotificationModule,
    ApprovalModule,
    AutomationModule,
    CrmModule,
    FinanceModule,
    FilesModule,
    SettingsModule,
    AdminModule,
    CeoChatModule,
    HealthModule,
    SequelizeModule.forFeature(SAAS_MODELS),
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
