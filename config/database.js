const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required database environment variable: ${name}`);
  }
  return value;
}

function port() {
  const value = Number(required('DB_PORT'));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }
  return value;
}

function databaseConfig() {
  const ssl = process.env.DB_SSL === 'true';
  return {
    dialect: 'postgres',
    host: required('DB_HOST'),
    port: port(),
    username: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    ...(ssl
      ? {
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized:
                process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            },
          },
        }
      : {}),
  };
}

module.exports = {
  development: databaseConfig(),
  test: databaseConfig(),
  production: databaseConfig(),
};
