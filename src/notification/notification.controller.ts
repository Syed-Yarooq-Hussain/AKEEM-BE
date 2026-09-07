import {
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
import { NotificationService } from './notification.service';
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['notifications', 'api/notifications'])
export class NotificationController {
  constructor(private service: NotificationService) {}
  @Get() list(
    @Req() r,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.list(
      r.user,
      Math.max(1, Number(page)),
      Math.min(100, Math.max(1, Number(limit))),
    );
  }
  @Patch(':id/read') read(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.service.read(r.user, id);
  }
  @Post('read-all') readAll(@Req() r) {
    return this.service.readAll(r.user);
  }
}
