import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiTaskService } from './ai-task.service';
import {
  AiTaskQueryDto,
  CreateAiTaskDto,
  UpdateAiTaskDto,
} from './dto/ai-task.dto';
@ApiTags('AI Tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['ai/tasks', 'api/ai/tasks'])
export class AiTaskController {
  constructor(private service: AiTaskService) {}
  @Post() create(@Req() r, @Body() d: CreateAiTaskDto) {
    return this.service.create(r.user, d);
  }
  @Get() list(@Req() r, @Query() q: AiTaskQueryDto) {
    return this.service.list(r.user, q);
  }
  @Get(':id') one(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.service.one(r.user, id);
  }
  @Patch(':id') update(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateAiTaskDto,
  ) {
    return this.service.update(r.user, id, d);
  }
  @Post(':id/run') run(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.service.run(r.user, id);
  }
  @Post(':id/cancel') cancel(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(r.user, id);
  }
  @Post(':id/retry') retry(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.service.retry(r.user, id);
  }
}
