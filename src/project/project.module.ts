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
import { PublicDemoController } from './public-demo.controller';

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
  controllers: [ProjectController, PublicDemoController],
  providers: [ProjectService, ProjectDemoService],
})
export class ProjectModule {}
