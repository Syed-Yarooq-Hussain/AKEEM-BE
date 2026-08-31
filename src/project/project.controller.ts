import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['projects', 'api/projects'])
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}
  @Post() @ApiOperation({ summary: 'Create a project in the current organization' })
  create(@Req() request, @Body() dto: CreateProjectDto) { return this.projectService.create(request.user, dto); }
  @Get() @ApiOperation({ summary: 'List current organization projects' })
  findAll(@Req() request) { return this.projectService.findAll(request.user); }
  @Get(':id') @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@Req() request, @Param('id', ParseIntPipe) id: number) { return this.projectService.findOne(request.user, id); }
}
