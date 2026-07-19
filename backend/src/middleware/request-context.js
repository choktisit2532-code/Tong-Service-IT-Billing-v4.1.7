const crypto = require('crypto');
const logger = require('../utils/logger');

function requestContext(req, res, next) {
    const inboundRequestId = req.get('x-request-id');
    req.requestId = inboundRequestId && inboundRequestId.length <= 100
        ? inboundRequestId
        : crypto.randomUUID();

    res.setHeader('X-Request-Id', req.requestId);
    next();
}

function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const meta = {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            ip: req.ip,
            userAgent: req.get('user-agent') || null
        };

        if (res.statusCode >= 500) logger.error('request.completed', meta);
        else if (res.statusCode >= 400) logger.warn('request.completed', meta);
        else logger.info('request.completed', meta);
    });

    next();
}

module.exports = { requestContext, requestLogger };
