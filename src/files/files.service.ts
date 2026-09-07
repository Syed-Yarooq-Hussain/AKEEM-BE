import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { FileAsset, Project, Report } from '../../models';
import { renderReportHtml, renderReportPdf } from './report-renderer';

const REPORT_FORMATS = ['markdown', 'html', 'pdf'] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

@Injectable()
export class FilesService {
  private readonly directory = join(process.cwd(), 'uploads');

  constructor(
    @InjectModel(FileAsset) private readonly assets: typeof FileAsset,
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Report) private readonly reportModel: typeof Report,
  ) {}

  async upload(auth: any, file: any, body: any) {
    if (!file) throw new BadRequestException('file is required');
    const projectId = body.projectId ? Number(body.projectId) : undefined;
    await this.project(auth, projectId);
    await mkdir(this.directory, { recursive: true });
    const key = `${auth.organizationId}-${Date.now()}-${String(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await writeFile(join(this.directory, key), file.buffer);
    return this.assets.create({
      organizationId: auth.organizationId,
      uploadedById: auth.id,
      originalName: file.originalname,
      storageKey: key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      entityType: projectId ? 'project' : undefined,
      entityId: projectId,
      metadata: {},
    });
  }

  async files(auth: any, projectId?: number) {
    return this.assets.findAll({
      where: {
        organizationId: auth.organizationId,
        ...(projectId ? { entityType: 'project', entityId: projectId } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async file(auth: any, id: number) {
    const file = await this.assets.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async remove(auth: any, id: number) {
    const file = await this.file(auth, id);
    try {
      await unlink(join(this.directory, file.storageKey));
    } catch {}
    await file.destroy();
    return { id, deleted: true };
  }

  async reports(auth: any, projectId?: number, assistant?: string) {
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
