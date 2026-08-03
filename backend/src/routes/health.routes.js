const express = require('express');
const pool = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { getDocumentSchemaStatus } = require('../services/schema.service');
const { version } = require('../../package.json');

const router = express.Router();

router.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Tong Service IT Billing API',
        version,
        uptime_seconds: Math.round(process.uptime())
    });
});

router.get('/ready', asyncHandler(async (_req, res) => {
    const startedAt = Date.now();

    try {
        const [databaseResult, schemaStatus, migrationsResult] = await Promise.all([
            pool.query('SELECT NOW() AS database_time'),
            getDocumentSchemaStatus(pool),
            pool.query(`
                SELECT filename, applied_at
                FROM schema_migrations
                ORDER BY applied_at DESC
                LIMIT 1
            `).catch(() => ({ rows: [] }))
        ]);

        const status = schemaStatus.ready ? 'ok' : 'degraded';
        return res.status(schemaStatus.ready ? 200 : 503).json({
            status,
            service: 'Tong Service IT Billing API',
            version,
            database_time: databaseResult.rows[0].database_time,
            database_schema: schemaStatus,
            latest_migration: migrationsResult.rows[0] || null,
            latency_ms: Date.now() - startedAt
        });
    } catch (error) {
        return res.status(503).json({
            status: 'down',
            service: 'Tong Service IT Billing API',
            version,
            database: 'unavailable',
            error: {
                code: 'DATABASE_NOT_READY',
                message: 'Database is not ready'
            },
            latency_ms: Date.now() - startedAt
        });
    }
}));

module.exports = router;
