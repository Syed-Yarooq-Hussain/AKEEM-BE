import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Company,
  Contact,
  Deal,
  Organization,
  Project,
  Task,
  User,
} from '../../models';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectDemoService } from './project-demo.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Project,
      Company,
      Contact,
      Deal,
      Organization,
      Task,
      User,
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectDemoService],
})
export class ProjectModule {}
