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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDemoService } from './project-demo.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['projects', 'api/projects'])
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly demoService: ProjectDemoService,
  ) {}
  @Post(':id/demo-data')
  @ApiOperation({
    summary: 'Insert synthetic project analysis data once (Owner/Admin only)',
  })
  seedDemo(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.demoService.seed(request.user, id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a project in the current organization' })
  create(@Req() request, @Body() dto: CreateProjectDto) {
    return this.projectService.create(request.user, dto);
  }
  @Get()
  @ApiOperation({ summary: 'List current organization projects' })
  findAll(@Req() request, @Query() query: ProjectQueryDto) {
    return this.projectService.findAll(request.user, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(request.user, id);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Req() request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(request.user, id, dto);
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Archive a project' })
  archive(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.projectService.archive(request.user, id);
  }
}
