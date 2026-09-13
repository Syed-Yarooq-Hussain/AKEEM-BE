import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  FileAsset,
  KnowledgeChunk,
  KnowledgeDocument,
  Project,
  Report,
} from '../../models';
import { DocumentIntelligenceService } from './document-intelligence.service';
import { FileSecurityService } from './file-security.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      FileAsset,
      Project,
      Report,
      KnowledgeDocument,
      KnowledgeChunk,
    ]),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FileSecurityService,
    DocumentIntelligenceService,
    KnowledgeRetrievalService,
  ],
  exports: [KnowledgeRetrievalService],
})
export class FilesModule {}
