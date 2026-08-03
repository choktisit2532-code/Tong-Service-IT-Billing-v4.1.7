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
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: {
            code: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
        }
    }
});

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

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT id, name, email, password_hash, role, active
         FROM users WHERE LOWER(email) = LOWER($1)`,
        [req.body.email]
    );
    const user = result.rows[0];
    const passwordMatches = user ? await bcrypt.compare(req.body.password, user.password_hash) : false;

    if (!user || !user.active || !passwordMatches) {
        await auditLogin({ email: req.body.email, success: false, req });
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
