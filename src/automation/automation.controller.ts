import {
  Body,
  Controller,
  Delete,
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
import { AutomationService } from './automation.service';
@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['automations', 'api/automations'])
export class AutomationController {
  constructor(private s: AutomationService) {}
  @Get() list(@Req() r, @Query('projectId') p?: string) {
    return this.s.list(r.user, p ? Number(p) : undefined);
  }
  @Post() create(@Req() r, @Body() b: any) {
    return this.s.create(r.user, b);
  }
  @Get(':id') one(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.one(r.user, id);
  }
  @Patch(':id') update(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
  ) {
    return this.s.update(r.user, id, b);
  }
  @Delete(':id') remove(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.remove(r.user, id);
  }
  @Post(':id/run') run(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.run(r.user, id);
  }
  @Get(':id/runs') runs(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.runs(r.user, id);
  }
}
