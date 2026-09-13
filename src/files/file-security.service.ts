import {
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { basename, extname } from 'path';
import { fromBuffer } from 'file-type';

export type ValidatedUpload = {
  originalName: string;
  extension: string;
  detectedMimeType: string;
  checksumSha256: string;
  scanStatus: 'clean' | 'not_configured';
};

const BINARY_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.bmp': ['image/bmp'],
  '.tif': ['image/tiff'],
  '.tiff': ['image/tiff'],
};

const TEXT_TYPES: Record<string, string[]> = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.md': ['text/markdown', 'text/plain', 'application/octet-stream'],
  '.markdown': ['text/markdown', 'text/plain', 'application/octet-stream'],
  '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.json': ['application/json', 'text/json', 'text/plain'],
};

@Injectable()
export class FileSecurityService {
  maxBytes() {
    const configured = Number(
      process.env.FILE_MAX_SIZE_BYTES || 10 * 1024 * 1024,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : 10 * 1024 * 1024;
  }

  async validate(file: any): Promise<ValidatedUpload> {
    const buffer = file?.buffer as Buffer | undefined;
    if (!buffer?.length) {
      throw new UnsupportedMediaTypeException({
        message: 'The uploaded file is empty or unreadable',
        code: 'FILE_EMPTY',
      });
    }
    if (buffer.length > this.maxBytes()) {
      throw new PayloadTooLargeException({
        message: `File exceeds the ${this.maxBytes()} byte upload limit`,
        code: 'FILE_TOO_LARGE',
      });
    }

    const originalName = this.safeFilename(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const expected = BINARY_TYPES[extension] || TEXT_TYPES[extension];
    if (!expected) {
      throw new UnsupportedMediaTypeException({
        message: `Unsupported file type: ${extension || 'missing extension'}`,
        code: 'FILE_TYPE_UNSUPPORTED',
      });
    }

    const detected = await fromBuffer(buffer);
    let detectedMimeType: string | undefined = detected?.mime;
    if (TEXT_TYPES[extension]) {
      this.validateUtf8(buffer);
      detectedMimeType = expected[0];
      if (!expected.includes(String(file.mimetype || '').toLowerCase())) {
        throw this.spoofed();
      }
    } else {
      const detectedAllowed = expected.includes(String(detectedMimeType));
      const claimedAllowed = expected.includes(
        String(file.mimetype || '').toLowerCase(),
      );
      if (!detectedAllowed || !claimedAllowed) throw this.spoofed();
    }

    const scanStatus = await this.scan(buffer, detectedMimeType, originalName);
    return {
      originalName,
      extension,
      detectedMimeType,
      checksumSha256: createHash('sha256').update(buffer).digest('hex'),
      scanStatus,
    };
  }

  safeFilename(value: string): string {
    const clean = basename(String(value || 'file'))
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[^\p{L}\p{N}._ -]+/gu, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    return clean && !['.', '..'].includes(clean) ? clean : 'file';
  }

  private validateUtf8(buffer: Buffer) {
    if (buffer.includes(0)) throw this.spoofed();
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw this.spoofed();
    }
  }

  private spoofed() {
    return new UnsupportedMediaTypeException({
      message: 'File content does not match its name or declared MIME type',
      code: 'FILE_MIME_MISMATCH',
    });
  }

  private async scan(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<'clean' | 'not_configured'> {
    const endpoint = process.env.MALWARE_SCAN_URL;
    if (!endpoint) {
      if (
        process.env.NODE_ENV === 'production' &&
        process.env.MALWARE_SCAN_REQUIRED === 'true'
      ) {
        throw new ServiceUnavailableException({
          message: 'File scanning service is not configured',
          code: 'MALWARE_SCAN_NOT_CONFIGURED',
        });
      }
      return 'not_configured';
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'X-File-Name': encodeURIComponent(filename),
          ...(process.env.MALWARE_SCAN_API_KEY
            ? { Authorization: `Bearer ${process.env.MALWARE_SCAN_API_KEY}` }
            : {}),
        },
        body: buffer,
        signal: AbortSignal.timeout(
          Number(process.env.MALWARE_SCAN_TIMEOUT_MS || 15_000),
        ),
      });
      if (!response.ok) throw new Error('scanner unavailable');
      const result = (await response.json()) as { clean?: boolean };
      if (result.clean !== true) {
        throw new UnsupportedMediaTypeException({
          message: 'File was rejected by the malware scanner',
          code: 'FILE_MALWARE_DETECTED',
        });
      }
      return 'clean';
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeException) throw error;
      throw new ServiceUnavailableException({
        message: 'File scanning service is temporarily unavailable',
        code: 'MALWARE_SCAN_UNAVAILABLE',
      });
    }
  }
}
