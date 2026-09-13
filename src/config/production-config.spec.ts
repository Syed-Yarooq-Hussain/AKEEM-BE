import { validateProductionConfig } from './production-config';

describe('production configuration validation', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('refuses DB synchronization in production', () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DB_HOST: 'db',
      DB_PORT: '5432',
      DB_USERNAME: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'akeem',
      JWT_SECRET: 'x'.repeat(32),
      OPENAI_API_KEY: 'sk-live-value',
      INTEGRATION_ENCRYPTION_KEY: 'x'.repeat(32),
      FRONTEND_URLS: 'https://app.example.com',
      FRONTEND_APP_URL: 'https://app.example.com',
      EMAIL_DELIVERY_ENABLED: 'false',
      DB_SYNC: 'true',
    });
    expect(() => validateProductionConfig()).toThrow(
      'DB_SYNC must be false in production',
    );
  });
});
