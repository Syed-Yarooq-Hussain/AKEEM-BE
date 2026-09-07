import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['dashboard', 'api/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('overview')
  overview(
    @Req() request,
    @Query('projectId', new ParseIntPipe({ optional: true }))
    projectId?: number,
    @Query('period') period = '6m',
  ) {
    return this.dashboardService.overview(request.user, projectId, period);
  }
}
