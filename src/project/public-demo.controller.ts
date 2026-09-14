import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProjectDemoService } from './project-demo.service';

@ApiTags('Demo')
@Controller()
export class PublicDemoController {
  constructor(private readonly demoService: ProjectDemoService) {}

  @Post([
    'projects/:id/demo-data',
    'api/projects/:id/demo-data',
    'demo/projects/:id/data',
    'api/demo/projects/:id/data',
  ])
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Insert demo data once for an existing project; no token required',
  })
  seed(@Param('id', ParseIntPipe) id: number) {
    return this.demoService.seedPublic(id);
  }
}
