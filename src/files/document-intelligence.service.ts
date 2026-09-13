import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import * as mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { recognize } from 'tesseract.js';
import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';
import { FileAsset, KnowledgeChunk, KnowledgeDocument } from '../../models';

type Section = { text: string; reference: string; metadata?: object };

@Injectable()
export class DocumentIntelligenceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DocumentIntelligenceService.name);
  private readonly directory = resolve(
    process.env.FILE_STORAGE_DIR || join(process.cwd(), 'uploads'),
  );
  private processing = false;
  private shuttingDown = false;
  private readonly active = new Set<Promise<void>>();
  private readonly immediates = new Set<NodeJS.Immediate>();
  private readonly retries = new Set<NodeJS.Timeout>();

  constructor(
    @InjectModel(FileAsset) private readonly files: typeof FileAsset,
    @InjectModel(KnowledgeDocument)
    private readonly documents: typeof KnowledgeDocument,
    @InjectModel(KnowledgeChunk)
    private readonly chunks: typeof KnowledgeChunk,
  ) {}

  async onModuleInit() {
    const pending = await this.files.findAll({
      where: { processingStatus: { [Op.in]: ['pending', 'processing'] } },
      attributes: ['id'],
      limit: 100,
    });
    for (const file of pending) this.enqueue(file.id);
  }

  enqueue(fileId: number) {
    if (this.shuttingDown) return;
    const immediate = setImmediate(() => {
      this.immediates.delete(immediate);
      if (this.shuttingDown) return;
      const work = this.process(fileId);
      this.active.add(work);
      void work.finally(() => this.active.delete(work));
    });
    this.immediates.add(immediate);
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    for (const immediate of this.immediates) clearImmediate(immediate);
    for (const retry of this.retries) clearTimeout(retry);
    this.immediates.clear();
    this.retries.clear();
    await Promise.allSettled([...this.active]);
  }

  async process(fileId: number) {
    if (this.processing) {
      const retry = setTimeout(() => {
        this.retries.delete(retry);
        this.enqueue(fileId);
      }, 100);
      retry.unref();
      this.retries.add(retry);
      return;
    }
    this.processing = true;
    let file: FileAsset | null = null;
    try {
      file = await this.files.findByPk(fileId);
      if (!file || file.processingStatus === 'ready') return;
      await file.update({
        processingStatus: 'processing',
        processingError: null,
      });
      const buffer = await readFile(join(this.directory, file.storageKey));
      const projectId =
        file.entityType === 'project' ? file.entityId : undefined;
      const [document] = await this.documents.findOrCreate({
        where: { fileId: file.id },
        defaults: {
          organizationId: file.organizationId,
          projectId,
          fileId: file.id,
          uploadedById: file.uploadedById,
          title: file.originalName,
          sourceType: 'upload',
          storageKey: file.storageKey,
          mimeType: file.detectedMimeType || file.mimeType,
          sizeBytes: file.sizeBytes,
          processingStatus: 'processing',
          metadata: { untrusted: true },
        },
      });
      await document.update({ processingStatus: 'processing' });
      const sections = await this.extract(file, buffer);
      const chunkRows = sections.flatMap((section) =>
        this.chunk(section.text).map((content, index) => ({
          organizationId: file.organizationId,
          projectId,
          fileId: file.id,
          knowledgeDocumentId: document.id,
          chunkIndex: index,
          content,
          reference: section.reference,
          metadata: { ...(section.metadata || {}), untrusted: true },
        })),
      );
      if (!chunkRows.length) throw new Error('No readable text was found');
      await this.chunks.destroy({
        where: { knowledgeDocumentId: document.id },
        force: true,
      });
      await this.chunks.bulkCreate(
        chunkRows.map((row, index) => ({ ...row, chunkIndex: index })),
      );
      await document.update({
        processingStatus: 'ready',
        metadata: { untrusted: true, chunkCount: chunkRows.length },
      });
      await file.update({
        processingStatus: 'ready',
        processingError: null,
        processedAt: new Date(),
      });
    } catch (error) {
      const message = this.safeExtractionError(error);
      this.logger.warn(`File ${fileId} extraction failed: ${message}`);
      if (file) {
        await file.update({
          processingStatus: 'failed',
          processingError: message,
          processedAt: new Date(),
        });
        await this.documents.update(
          { processingStatus: 'failed', metadata: { error: message } },
          { where: { fileId } },
        );
      }
    } finally {
      this.processing = false;
    }
  }

  sanitize(text: string) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/<\|[^>]{0,100}\|>/g, '[removed control token]')
      .replace(
        /\b(ignore|disregard|override)\s+(all\s+)?(previous|prior|system|developer)\s+instructions?\b/gi,
        '[potential prompt injection removed]',
      )
      .replace(
        /\b(system|developer)\s+(message|prompt)\s*:/gi,
        '[untrusted label]:',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  chunk(text: string, size = 3000, overlap = 250) {
    const clean = this.sanitize(text);
    if (!clean) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(clean.length, start + size);
      if (end < clean.length) {
        const boundary = Math.max(
          clean.lastIndexOf('. ', end),
          clean.lastIndexOf(' ', end),
        );
        if (boundary > start + size / 2) end = boundary + 1;
      }
      chunks.push(clean.slice(start, end).trim());
      if (end >= clean.length) break;
      start = Math.max(start + 1, end - overlap);
    }
    return chunks.filter(Boolean);
  }

  private async extract(file: FileAsset, buffer: Buffer): Promise<Section[]> {
    const mime = file.detectedMimeType || file.mimeType || '';
    if (mime === 'application/pdf') return this.pdf(buffer);
    if (
      mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return [{ text: result.value, reference: 'document' }];
    }
    if (
      mime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return this.spreadsheet(buffer);
    }
    if (mime.startsWith('image/')) {
      return [
        {
          text: await this.ocr(buffer),
          reference: 'image',
          metadata: { ocr: true },
        },
      ];
    }
    const text = buffer.toString('utf8');
    if (mime === 'application/json') {
      return [
        {
          text: JSON.stringify(JSON.parse(text), null, 2),
          reference: 'document',
        },
      ];
    }
    if (file.originalName.toLowerCase().endsWith('.csv')) {
      const rows = text.split(/\r?\n/);
      const sections: Section[] = [];
      for (let index = 0; index < rows.length; index += 100) {
        sections.push({
          text: rows.slice(index, index + 100).join('\n'),
          reference: `rows ${index + 1}-${Math.min(index + 100, rows.length)}`,
        });
      }
      return sections;
    }
    return [{ text, reference: 'document' }];
  }

  private async pdf(buffer: Buffer): Promise<Section[]> {
    if (buffer.toString('latin1').includes('/Encrypt')) {
      throw new Error('Encrypted PDFs are not supported');
    }
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
      const maxPages = Number(process.env.DOCUMENT_MAX_PAGES || 100);
      if (pdf.numPages > maxPages) {
        throw new Error(`PDF exceeds the ${maxPages} page limit`);
      }
      const extracted = await extractText(pdf);
      const pages = Array.isArray(extracted.text)
        ? extracted.text
        : [extracted.text];
      const sections: Section[] = [];
      const ocrMaxPages = Number(process.env.OCR_MAX_PAGES || 20);
      for (let index = 0; index < pages.length; index++) {
        let text = pages[index] || '';
        let ocr = false;
        if (text.trim().length < 20 && index < ocrMaxPages) {
          const image = await renderPageAsImage(pdf, index + 1, { scale: 2 });
          text = await this.ocr(Buffer.from(image));
          ocr = true;
        }
        if (text.trim()) {
          sections.push({
            text,
            reference: `page ${index + 1}`,
            metadata: { page: index + 1, ocr },
          });
        }
      }
      return sections;
    } finally {
      await (pdf as any).destroy?.();
    }
  }

  private async spreadsheet(buffer: Buffer): Promise<Section[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sections: Section[] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values : [];
        rows.push(
          values
            .slice(1)
            .map((cell: any) => String(cell ?? ''))
            .join('\t'),
        );
      });
      sections.push({
        text: rows.join('\n'),
        reference: `sheet ${sheet.name}`,
        metadata: { sheet: sheet.name },
      });
    });
    return sections;
  }

  private async ocr(buffer: Buffer) {
    if (process.env.OCR_ENABLED === 'false') {
      throw new Error('OCR is disabled');
    }
    const timeoutMs = Number(process.env.OCR_TIMEOUT_MS || 60_000);
    const result = await Promise.race([
      recognize(buffer, process.env.OCR_LANGUAGE || 'eng'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out')), timeoutMs),
      ),
    ]);
    return result.data.text;
  }

  private safeExtractionError(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/encrypted|password/i.test(message))
      return 'Encrypted files are not supported';
    if (/page limit/i.test(message)) return message;
    if (/ocr timed out/i.test(message)) return 'OCR processing timed out';
    if (/no readable text/i.test(message)) return 'No readable text was found';
    return 'File content could not be extracted';
  }
}
