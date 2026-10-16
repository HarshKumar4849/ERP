const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.qa') });

const DEFAULT_DATABASE = 'mongodb://127.0.0.1:27017/tecmotiv_qa';

function databaseName(uri) {
  try {
    return new URL(uri).pathname.replace(/^\//, '').split('?')[0];
  } catch {
    return '';
  }
}

function assertSafeQaDatabase(uri = process.env.DATABASE || DEFAULT_DATABASE) {
  const name = databaseName(uri).toLowerCase();
  const explicitlyAllowed = process.env.QA_ALLOW_DATABASE === 'true';
  const isQaName = /(^|[-_])qa([-_]|$)/.test(name) || /test/.test(name);

  if (!explicitlyAllowed && !isQaName) {
    throw new Error(
      `Refusing QA database '${name || '[unknown]'}'. Use a database name containing 'qa' or 'test'.`,
    );
  }

  if (/production|prod|staging|development|dev/.test(name) && !explicitlyAllowed) {
    throw new Error(`Refusing non-test database '${name}'.`);
  }

  return uri;
}

module.exports = {
  DATABASE: assertSafeQaDatabase(),
  HOST: process.env.QA_API_HOST || '127.0.0.1',
  PORT: Number(process.env.QA_API_PORT || 0),
  FRONTEND_URL: process.env.QA_FRONTEND_URL || '',
  PASSWORD: process.env.QA_FIXTURE_PASSWORD || 'TecMotiv-QA-Only-2026!',
  RUN_ID: process.env.QA_RUN_ID || `${Date.now()}-${process.pid}`,
  assertSafeQaDatabase,
};
