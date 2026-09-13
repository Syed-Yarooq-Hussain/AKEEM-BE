import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Company,
  Contact,
  Deal,
  Membership,
  Pipeline,
  PipelineStage,
} from '../../models';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Company,
      Contact,
      Deal,
      Pipeline,
      PipelineStage,
      Membership,
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
