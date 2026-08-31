import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserModule } from './user/user.module';
import { SAAS_MODELS } from '../models';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { CeoChatModule } from './ceo-chat/ceo-chat.module';
import { ProjectModule } from './project/project.module';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'appUser',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'ki_agentic_app',
      models: SAAS_MODELS,
      autoLoadModels: false,
      synchronize: process.env.DB_SYNC === 'true',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    }),
    UserModule,
    AuthModule, PassportModule, ProjectModule, CeoChatModule,
    SequelizeModule.forFeature(SAAS_MODELS),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
