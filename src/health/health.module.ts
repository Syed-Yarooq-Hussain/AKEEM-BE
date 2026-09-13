import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AutomationModule } from '../automation/automation.module';

@Module({ imports: [AutomationModule], controllers: [HealthController] })
export class HealthModule {}
