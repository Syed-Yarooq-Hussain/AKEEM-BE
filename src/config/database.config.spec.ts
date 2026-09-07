import { databaseConfig } from './database.config';

const KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_SYNC',
  'DB_LOGGING',
  'DB_SSL',
  'DB_SSL_REJECT_UNAUTHORIZED',
] as const;

describe('databaseConfig', () => {
  const original = Object.fromEntries(
    KEYS.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    Object.assign(process.env, {
      DB_HOST: 'db.internal',
      DB_PORT: '5433',
      DB_USERNAME: 'application',
      DB_PASSWORD: 'test-secret',
      DB_NAME: 'application_test',
      DB_SYNC: 'false',
      DB_LOGGING: 'false',
      DB_SSL: 'false',
    });
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('reads every connection value from the environment', () => {
    expect(databaseConfig()).toMatchObject({
      host: 'db.internal',
      port: 5433,
      username: 'application',
      password: 'test-secret',
      database: 'application_test',
      synchronize: false,
      logging: false,
    });
  });

  it('fails early instead of silently using a hard-coded password', () => {
    delete process.env.DB_PASSWORD;
    expect(() => databaseConfig()).toThrow(
      'Missing required database environment variable: DB_PASSWORD',
    );
  });
});
