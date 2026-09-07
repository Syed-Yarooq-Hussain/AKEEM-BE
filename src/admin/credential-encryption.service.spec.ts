import { CredentialEncryptionService } from './credential-encryption.service';

describe('CredentialEncryptionService', () => {
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined)
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts credentials at rest and can decrypt them', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY =
      'test-key-that-is-not-used-in-production';
    const service = new CredentialEncryptionService();
    const encrypted = service.encrypt({ accessToken: 'top-secret' });

    expect(JSON.stringify(encrypted)).not.toContain('top-secret');
    expect(service.decrypt(encrypted)).toEqual({ accessToken: 'top-secret' });
  });
});
