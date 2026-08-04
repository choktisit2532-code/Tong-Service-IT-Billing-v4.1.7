const { Pool, Client } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

function createPool(connectionString, options = {}) {
    const pool = new Pool({
        connectionString,
        max: options.max ?? env.databasePoolMax,
        idleTimeoutMillis: env.databaseIdleTimeoutMs,
        connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
        ssl: env.databaseSsl
            ? { rejectUnauthorized: env.databaseSslRejectUnauthorized }
            : false
    });

    pool.on('error', (error) => {
        logger.error('database.pool.unexpected_error', { message: error.message, code: error.code });
    });
    return pool;
}

if (process.env.CF_WORKER_RUNTIME === 'true') {
    async function createWorkerClient() {
        const { env: workerEnv } = await import('cloudflare:workers');
        // Hyperdrive owns the durable connection pool. A fresh pg Client per
        // Worker request is the supported lifecycle and avoids stale sockets.
        const client = new Client({ connectionString: workerEnv.HYPERDRIVE.connectionString });
        await client.connect();
        return client;
    }

    module.exports = {
        async query(...args) {
            const client = await createWorkerClient();
            try {
                return await client.query(...args);
            } finally {
                await client.end();
            }
        },
        async connect() {
            const client = await createWorkerClient();
            client.release = () => client.end();
            return client;
        },
        async end() {
            // Individual Worker clients are closed after each query or release.
        }
    };
} else {
    module.exports = createPool(env.databaseUrl);
}
