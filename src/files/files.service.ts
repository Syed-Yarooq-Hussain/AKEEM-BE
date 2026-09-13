import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  FileAsset,
  KnowledgeChunk,
  KnowledgeDocument,
  Project,
  Report,
} from '../../models';
import { DocumentIntelligenceService } from './document-intelligence.service';
import { FileSecurityService } from './file-security.service';
import { renderReportHtml, renderReportPdf } from './report-renderer';

const REPORT_FORMATS = ['markdown', 'html', 'pdf'] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

@Injectable()
export class FilesService {
  private readonly directory = resolve(
    process.env.FILE_STORAGE_DIR || join(process.cwd(), 'uploads'),
  );

  constructor(
    @InjectModel(FileAsset) private readonly assets: typeof FileAsset,
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Report) private readonly reportModel: typeof Report,
    @InjectModel(KnowledgeDocument)
    private readonly documents: typeof KnowledgeDocument,
    @InjectModel(KnowledgeChunk)
    private readonly chunks: typeof KnowledgeChunk,
    private readonly security: FileSecurityService,
    private readonly intelligence: DocumentIntelligenceService,
  ) {}

  async upload(auth: any, file: any, body: any) {
    if (!file) throw new BadRequestException('file is required');
    const projectId = body.projectId ? Number(body.projectId) : undefined;
    await this.project(auth, projectId);
    const validation = await this.security.validate(file);
    await mkdir(this.directory, { recursive: true });
    const key = `${auth.organizationId}-${randomUUID()}${validation.extension}`;
    await writeFile(join(this.directory, key), file.buffer, { flag: 'wx' });
    let asset: FileAsset;
    try {
      asset = await this.assets.create({
        organizationId: auth.organizationId,
        uploadedById: auth.id,
        originalName: validation.originalName,
        storageKey: key,
        mimeType: validation.detectedMimeType,
        detectedMimeType: validation.detectedMimeType,
        checksumSha256: validation.checksumSha256,
        scanStatus: validation.scanStatus,
        processingStatus: 'pending',
        sizeBytes: file.buffer.length,
        entityType: projectId ? 'project' : undefined,
        entityId: projectId,
        metadata: { uploadedMimeType: file.mimetype },
      });
    } catch (error) {
      await unlink(join(this.directory, key)).catch(() => undefined);
      throw error;
    }
    this.intelligence.enqueue(asset.id);
    return this.present(asset);
  }

  async files(auth: any, projectId?: number) {
    await this.project(auth, projectId);
    const rows = await this.assets.findAll({
      where: {
        organizationId: auth.organizationId,
        ...(projectId ? { entityType: 'project', entityId: projectId } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
    return rows.map((file) => this.present(file));
  }

  async file(auth: any, id: number) {
    return this.present(await this.rawFile(auth, id));
  }

  async downloadFile(auth: any, id: number, response: any) {
    const file = await this.rawFile(auth, id);
    const content = await readFile(join(this.directory, file.storageKey)).catch(
      () => null,
    );
    if (!content)
      throw new NotFoundException('Stored file content was not found');
    const filename = this.security.safeFilename(file.originalName);
    const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    response.setHeader(
      'Content-Type',
      file.detectedMimeType || file.mimeType || 'application/octet-stream',
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return response.send(content);
  }

  async reprocess(auth: any, id: number) {
    const file = await this.rawFile(auth, id);
    await file.update({
      processingStatus: 'pending',
      processingError: null,
      processedAt: null,
    });
    this.intelligence.enqueue(file.id);
    return this.present(file);
  }

  async remove(auth: any, id: number) {
    const file = await this.rawFile(auth, id);
    await this.chunks.destroy({
      where: { fileId: file.id, organizationId: auth.organizationId },
      force: true,
    });
    await this.documents.destroy({
      where: { fileId: file.id, organizationId: auth.organizationId },
      force: true,
    });
    await unlink(join(this.directory, file.storageKey)).catch(() => undefined);
    await file.destroy();
    return { id, deleted: true, knowledgeEntriesDeleted: true };
  }

  async reports(auth: any, projectId?: number, assistant?: string) {
    await this.project(auth, projectId);
    return this.reportModel.findAll({
      where: {
        organizationId: auth.organizationId,
        ...(projectId ? { projectId } : {}),
        ...(assistant ? { assistant } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async generate(auth: any, body: any) {
    await this.project(auth, body.projectId);
    const format = String(body.format || 'markdown').toLowerCase();
    if (!REPORT_FORMATS.includes(format as ReportFormat)) {
      throw new BadRequestException(
        `format must be one of: ${REPORT_FORMATS.join(', ')}`,
      );
    }
    const project = body.projectId
      ? await this.projects.findOne({
          where: { id: body.projectId, organizationId: auth.organizationId },
        })
      : null;
    const title = body.title || `${project?.name || 'Business'} Report`;
    const content =
      body.content ||
      `# ${title}\n\nProject: ${project?.name || 'Organization-wide'}\nAssistant: ${body.assistant || 'ceo'}\nGenerated: ${new Date().toISOString()}\n\nThis report is ready for review.`;
    return this.reportModel.create({
      organizationId: auth.organizationId,
      projectId: body.projectId,
      createdById: auth.id,
      title,
      assistant: body.assistant || 'ceo',
      status: 'generated',
      content,
      format,
      metadata: {
        ...(body.metadata || {}),
        sourceFormat: 'markdown',
        renderedOnDownload: format !== 'markdown',
      },
    });
  }

  async report(auth: any, id: number) {
    const report = await this.reportModel.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async download(auth: any, id: number, response: any) {
    const report = await this.report(auth, id);
    const format = REPORT_FORMATS.includes(report.format as ReportFormat)
      ? (report.format as ReportFormat)
      : 'markdown';
    const filename = this.filename(report.title || `report-${id}`);
    const content = report.content || '';
    if (format === 'pdf') {
      const pdf = await renderReportPdf(report.title || filename, content);
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.pdf"`,
      );
      return response.send(pdf);
    }
    if (format === 'html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.html"`,
      );
      return response.send(renderReportHtml(report.title || filename, content));
    }
    response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.md"`,
    );
    return response.send(content);
  }

  private async rawFile(auth: any, id: number) {
    const file = await this.assets.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!file) throw new NotFoundException('File not found');
    const projectId = file.entityType === 'project' ? file.entityId : undefined;
    await this.project(auth, projectId);
    return file;
  }

  private present(file: FileAsset) {
    return {
      id: file.id,
      organizationId: file.organizationId,
      uploadedById: file.uploadedById,
      originalName: file.originalName,
      mimeType: file.detectedMimeType || file.mimeType,
      sizeBytes: Number(file.sizeBytes || 0),
      projectId: file.entityType === 'project' ? file.entityId : null,
      entityType: file.entityType || null,
      entityId: file.entityId || null,
      processingStatus: file.processingStatus || 'pending',
      processingError: file.processingError || null,
      scanStatus: file.scanStatus || 'not_configured',
      processedAt: file.processedAt || null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private async project(auth: any, id?: number) {
    if (
      id &&
      !(await this.projects.findOne({
        where: { id, organizationId: auth.organizationId },
      }))
    ) {
      throw new NotFoundException('Project not found in your organization');
    }
  }

  private filename(value: string) {
    return (
      String(value)
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'report'
    );
  }
}
