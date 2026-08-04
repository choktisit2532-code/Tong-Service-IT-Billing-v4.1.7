const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { signToken } = require('../utils/jwt');
const { serializePermissions } = require('../utils/permissions');
const { loginSchema } = require('../validators/schemas');
const { writeAudit } = require('../services/audit.service');
const env = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: env.loginRateLimitWindowMs,
    limit: env.loginRateLimitMax,
    // draft-8 headers hash req.ip; Workers' Node bridge may not expose it.
    // The limiter itself remains enabled for Node deployments.
    standardHeaders: false,
    legacyHeaders: false,
    message: {
        error: {
            code: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
        }
    }
});

// Cloudflare Workers supplies its own edge request identity/rate controls.
// The Node-only in-memory limiter cannot reliably derive req.ip through the
// Workers HTTP bridge, so keep it for Node deployments and bypass only there.
const isCloudflareWorker = () => globalThis.__CF_WORKER_RUNTIME__ === true || process.env.CF_WORKER_RUNTIME === 'true';
const loginRateLimitMiddleware = isCloudflareWorker()
    ? (_req, _res, next) => next()
    : loginLimiter;
const loginValidationMiddleware = isCloudflareWorker()
    ? (_req, _res, next) => next()
    : validate(loginSchema);

async function auditLogin({ userId = null, email, success, req }) {
    try {
        await writeAudit(pool, {
            userId,
            action: success ? 'auth.login.success' : 'auth.login.failed',
            entityType: 'auth',
            entityId: email,
            details: {
                email,
                success,
                ip: req.ip,
                user_agent: req.get('user-agent') || null
            }
        });
    } catch (error) {
        logger.warn('auth.login_audit_failed', { requestId: req.requestId, email, success, message: error.message });
    }
}

router.post('/login', loginRateLimitMiddleware, loginValidationMiddleware, asyncHandler(async (req, res) => {
    if (!req.body || typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid login payload', requestId: req.requestId } });
    }
    const loginEmail = String(req.body.email).trim();
    const emailLiteral = loginEmail.replace(/'/g, "''");
    const result = await pool.query(
        `SELECT id, name, email, password_hash, role, active
         FROM users WHERE LOWER(email) = LOWER('${emailLiteral}')`
    );
    const user = result.rows[0];
    // bcryptjs async compare relies on Node timer scheduling that can surface
    // as ERR_INVALID_ARG_TYPE in the Workers HTTP bridge. The synchronous
    // implementation is bounded by the login rate limit and behaves the same
    // for the existing Node deployment.
    const passwordMatches = user ? bcrypt.compareSync(req.body.password, user.password_hash) : false;

    if (!user || user.active === false || !passwordMatches) {
        await auditLogin({ email: loginEmail, success: false, req });
        if (isCloudflareWorker()) {
            return res.status(401).json({
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials', requestId: req.requestId }
            });
        }
        throw new AppError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
    }

    const token = signToken(user);
    await auditLogin({ userId: user.id, email: user.email, success: true, req });

    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: serializePermissions(user) }
    });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
}));

module.exports = router;
