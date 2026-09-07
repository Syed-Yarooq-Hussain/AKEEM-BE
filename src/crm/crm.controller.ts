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
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['crm', 'api/crm'])
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('overview')
  overview(@Req() request) {
    return this.service.overview(request.user);
  }

  @Get('pipelines')
  pipelines(@Req() request) {
    return this.service.pipelines(request.user);
  }

  @Patch('deals/:id/stage')
  stage(
    @Req() request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.service.stage(request.user, id, body);
  }

  @Get(':resource')
  list(
    @Req() request,
    @Param('resource') resource: string,
    @Query() query: any,
  ) {
    return this.service.list(request.user, resource, query);
  }

  @Post(':resource')
  create(
    @Req() request,
    @Param('resource') resource: string,
    @Body() body: any,
  ) {
    return this.service.create(request.user, resource, body);
  }

  @Get(':resource/:id')
  one(
    @Req() request,
    @Param('resource') resource: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.one(request.user, resource, id);
  }

  @Patch(':resource/:id')
  update(
    @Req() request,
    @Param('resource') resource: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.service.update(request.user, resource, id, body);
  }

  @Delete(':resource/:id')
  remove(
    @Req() request,
    @Param('resource') resource: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.remove(request.user, resource, id);
  }
}
