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
const { passwordResetRequestSchema, passwordResetConfirmSchema } = require('../validators/schemas');
const crypto = require('crypto');
const { withTransaction } = require('../utils/db-transaction');
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

async function sendResetEmail(email, token) {
    if (!env.resendApiKey) throw new AppError(503, 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน', 'EMAIL_NOT_CONFIGURED');
    const resetUrl = `${env.appBaseUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `Tong Service IT <${env.emailFrom}>`, to: [email], subject: 'ตั้งรหัสผ่านใหม่ - Tong Service IT', html: `<p>กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:</p><p><a href="${resetUrl}">ตั้งรหัสผ่านใหม่</a></p><p>ลิงก์หมดอายุใน 20 นาที และใช้ได้ครั้งเดียว</p>` })
    });
    if (!response.ok) throw new AppError(503, 'ส่งอีเมลตั้งรหัสผ่านไม่สำเร็จ', 'EMAIL_SEND_FAILED');
}

router.post('/forgot-password', asyncHandler(async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'กรุณากรอกอีเมลให้ถูกต้อง', 'VALIDATION_ERROR');
    const userResult = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = $1 AND active = TRUE', [parsed.data.email.toLowerCase()]);
    const user = userResult.rows[0];
    if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await withTransaction(async (client) => {
            await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
            await client.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '20 minutes')", [tokenHash, user.id]);
        }, { name: 'auth.forgot_password' });
        await sendResetEmail(env.passwordResetRecoveryEmail || user.email, token);
    }
    res.json({ message: 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว' });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
    const parsed = passwordResetConfirmSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'รหัสผ่านใหม่ไม่เป็นไปตามเงื่อนไข', 'VALIDATION_ERROR');
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    await withTransaction(async (client) => {
        const found = await client.query(`SELECT t.user_id FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW() AND u.active = TRUE FOR UPDATE`, [tokenHash]);
        if (!found.rows[0]) throw new AppError(400, 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', 'RESET_TOKEN_INVALID');
        await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [await bcrypt.hash(parsed.data.password, 12), found.rows[0].user_id]);
        await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1', [tokenHash]);
    }, { name: 'auth.reset_password' });
    res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
}));

module.exports = router;
