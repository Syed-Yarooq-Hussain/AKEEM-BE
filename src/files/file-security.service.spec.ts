import { UnsupportedMediaTypeException } from '@nestjs/common';
import { FileSecurityService } from './file-security.service';

describe('FileSecurityService', () => {
  const service = new FileSecurityService();

  it('rejects a spoofed MIME and extension', async () => {
    await expect(
      service.validate({
        originalname: '../../invoice.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('this is not a PDF'),
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('sanitizes unsafe filenames', () => {
    expect(service.safeFilename('../../evil\u0000<script>.txt')).toBe(
      'evil_script_.txt',
    );
  });
});
