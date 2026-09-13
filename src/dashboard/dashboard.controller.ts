import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

class DashboardQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) projectId?: number;
  @IsOptional() @IsIn(['7d', '30d', '1m', '3m', '6m', '12m', '1y']) period =
    '6m';
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['dashboard', 'api/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('overview')
  overview(@Req() request, @Query() query: DashboardQuery) {
    return this.dashboardService.overview(
      request.user,
      query.projectId,
      query.period,
    );
  }
}
