const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
    connectionString: env.databaseUrl,
    max: env.databasePoolMax,
    idleTimeoutMillis: env.databaseIdleTimeoutMs,
    connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
    ssl: env.databaseSsl
        ? { rejectUnauthorized: env.databaseSslRejectUnauthorized }
        : false
});

pool.on('error', (error) => {
    logger.error('database.pool.unexpected_error', { message: error.message, code: error.code });
});

module.exports = pool;
