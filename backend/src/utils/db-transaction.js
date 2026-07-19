const pool = require('../config/db');
const env = require('../config/env');
const logger = require('./logger');

async function withTransaction(work, options = {}) {
    const client = await pool.connect();
    const transactionName = options.name || 'database.transaction';

    try {
        await client.query('BEGIN');

        if (env.transactionStatementTimeoutMs) {
            await client.query("SELECT set_config('statement_timeout', $1, true)", [String(env.transactionStatementTimeoutMs)]);
        }
        if (env.transactionLockTimeoutMs) {
            await client.query("SELECT set_config('lock_timeout', $1, true)", [String(env.transactionLockTimeoutMs)]);
        }

        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch((rollbackError) => {
            logger.error('database.rollback_failed', {
                transactionName,
                message: rollbackError.message
            });
        });
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { withTransaction };
