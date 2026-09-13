import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { access, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { Sequelize } from 'sequelize-typescript';
import { AutomationService } from '../automation/automation.service';

@ApiTags('Health')
@Controller(['health', 'api/health'])
export class HealthController {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly automations: AutomationService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Database, storage, AI, and worker readiness probe',
  })
  async ready() {
    const checks: Record<string, boolean> = {
      database: false,
      storage: false,
      ai: Boolean(process.env.OPENAI_API_KEY),
      automationWorker: this.automations.isWorkerReady(),
    };
    try {
      await this.sequelize.authenticate();
      checks.database = true;
    } catch {}
    try {
      const storage = resolve(process.env.FILE_STORAGE_DIR || 'uploads');
      await mkdir(storage, { recursive: true });
      await access(storage);
      checks.storage = true;
    } catch {}

    if (!Object.values(checks).every(Boolean)) {
      throw new ServiceUnavailableException({
        message: 'Service is not ready',
        code: 'SERVICE_NOT_READY',
        checks,
      });
    }
    return { status: 'ready', checks, timestamp: new Date().toISOString() };
  }
}
