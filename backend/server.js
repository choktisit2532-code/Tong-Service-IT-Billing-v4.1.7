require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const pool = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { version } = require('./package.json');

async function checkDatabaseOnStartup() {
    try {
        await pool.query('SELECT 1');
        logger.info('database.startup_verified');
    } catch (error) {
        logger.warn('database.startup_degraded', { message: error.message, code: error.code });
    }
}

async function closePool() {
    try {
        await pool.end();
        logger.info('database.pool_closed');
    } catch (error) {
        logger.error('database.pool_close_failed', { message: error.message });
    }
}

function start() {
    const server = http.createServer(app);

    server.listen(env.port, '0.0.0.0', () => {
        logger.info('server.started', {
            name: 'Tong Service IT Billing API',
            version,
            port: env.port,
            nodeEnv: env.nodeEnv
        });
    });

    server.on('error', (error) => {
        logger.error('server.error', { message: error.message, code: error.code });
        process.exit(1);
    });

    checkDatabaseOnStartup();

    const shutdown = async (signal) => {
        logger.info('server.shutdown_started', { signal });
        server.close(async () => {
            await closePool();
            logger.info('server.shutdown_completed', { signal });
            process.exit(0);
        });

        setTimeout(async () => {
            logger.error('server.shutdown_forced', { signal, timeoutMs: 10000 });
            await closePool();
            process.exit(1);
        }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        logger.error('process.unhandled_rejection', {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined
        });
    });
    process.on('uncaughtException', (error) => {
        logger.error('process.uncaught_exception', { message: error.message, stack: error.stack });
        shutdown('uncaughtException');
    });
}

start();
