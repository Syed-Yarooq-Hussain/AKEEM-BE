import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

type EncryptedCredentials = {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
};

@Injectable()
export class CredentialEncryptionService {
  encrypt(value: object): EncryptedCredentials | Record<string, never> {
    if (!value || !Object.keys(value).length) return {};
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt(value: EncryptedCredentials | Record<string, never>): object {
    if (!value || !('ciphertext' in value)) return {};
    const key = this.key();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext);
  }

  private key(): Buffer {
    const configured = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!configured && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException({
        message: 'Integration credential encryption is not configured',
        code: 'CREDENTIAL_ENCRYPTION_NOT_CONFIGURED',
      });
    }
    return createHash('sha256')
      .update(
        configured ||
          process.env.JWT_SECRET ||
          'development-only-integration-encryption-key',
      )
      .digest();
  }
}
