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
import { AdminService } from './admin.service';
@ApiTags('Administration')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['admin', 'api/admin'])
export class AdminController {
  constructor(private s: AdminService) {}
  @Get('users') users(@Req() r) {
    return this.s.users(r.user);
  }
  @Get('usage') usage(@Req() r, @Query('period') p?: string) {
    return this.s.usage(r.user, p);
  }
  @Get('audit-logs') logs(@Req() r, @Query() q: any) {
    return this.s.logs(r.user, q);
  }
  @Get('integrations') integrations(@Req() r) {
    return this.s.integrations(r.user);
  }
  @Post('integrations') create(@Req() r, @Body() b: any) {
    return this.s.createIntegration(r.user, b);
  }
  @Patch('integrations/:id') update(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
  ) {
    return this.s.updateIntegration(r.user, id, b);
  }
  @Delete('integrations/:id') remove(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.removeIntegration(r.user, id);
  }
}
