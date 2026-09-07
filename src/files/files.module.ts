import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileAsset, Project, Report } from '../../models';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
@Module({
  imports: [SequelizeModule.forFeature([FileAsset, Project, Report])],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
