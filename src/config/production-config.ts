const PLACEHOLDER = /^(change|replace|your-|sk-your|re_your)/i;

function configured(name: string) {
  const value = String(process.env[name] || '').trim();
  return Boolean(value && !PLACEHOLDER.test(value));
}

export function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'OPENAI_API_KEY',
    'INTEGRATION_ENCRYPTION_KEY',
    'FRONTEND_URLS',
    'FRONTEND_APP_URL',
  ];
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'false') {
    required.push('EMAIL_API_URL', 'EMAIL_API_KEY', 'EMAIL_FROM');
  }
  if (process.env.MALWARE_SCAN_REQUIRED === 'true') {
    required.push('MALWARE_SCAN_URL');
  }

  const missing = required.filter((name) => !configured(name));
  if (missing.length) {
    throw new Error(
      `Production configuration is missing or uses placeholders: ${missing.join(', ')}`,
    );
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters in production',
    );
  }
  if (process.env.DB_SYNC === 'true') {
    throw new Error(
      'DB_SYNC must be false in production; run migrations instead',
    );
  }
  if ((process.env.FRONTEND_URLS || '').split(',').includes('*')) {
    throw new Error('Wildcard CORS is not allowed in production');
  }
}
