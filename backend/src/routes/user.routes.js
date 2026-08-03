const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/db-transaction');
const { writeAudit } = require('../services/audit.service');
const {
    idSchema,
    userCreateSchema,
    userPasswordResetSchema,
    documentReasonSchema
} = require('../validators/schemas');

const router = express.Router();
router.use(authenticate, authorize('user.manage'));

router.get('/', asyncHandler(async (_req, res) => {
    const result = await pool.query(
        `SELECT id, name, email, role, active, created_at
         FROM users
         ORDER BY active DESC, name`
    );
    res.json({ data: result.rows });
}));

router.post('/', validate(userCreateSchema), asyncHandler(async (req, res) => {
    const createdUser = await withTransaction(async (client) => {
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const result = await client.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, LOWER($2), $3, $4)
             RETURNING id, name, email, role, active, created_at`,
            [req.body.name, req.body.email, passwordHash, req.body.role]
        );

        await writeAudit(client, {
            userId: req.user.id,
            action: 'CREATE',
            entityType: 'user',
            entityId: result.rows[0].id,
            details: { email: result.rows[0].email, role: result.rows[0].role }
        });

        return result.rows[0];
    }, { name: 'user.create' });

    res.status(201).json({ data: createdUser });
}));

router.patch('/:id/password', validate(idSchema, 'params'), validate(userPasswordResetSchema), asyncHandler(async (req, res) => {
    const updatedUser = await withTransaction(async (client) => {
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const result = await client.query(
            `UPDATE users
             SET password_hash = $1, updated_at = NOW()
             WHERE id = $2 AND active = TRUE
             RETURNING id, name, email, role, active`,
            [passwordHash, req.params.id]
        );

        if (!result.rows[0]) {
            throw new AppError(404, 'ไม่พบผู้ใช้ที่กำลังใช้งาน', 'USER_NOT_FOUND');
        }

        await writeAudit(client, {
            userId: req.user.id,
            action: 'RESET_PASSWORD',
            entityType: 'user',
            entityId: req.params.id,
            details: { email: result.rows[0].email }
        });

        return result.rows[0];
    }, { name: 'user.reset_password' });

    res.json({ data: updatedUser });
}));

router.patch('/:id/deactivate', validate(idSchema, 'params'), validate(documentReasonSchema), asyncHandler(async (req, res) => {
    if (Number(req.params.id) === Number(req.user.id)) {
        throw new AppError(400, 'ไม่สามารถปิดการใช้งานบัญชีของตนเองได้', 'SELF_DEACTIVATE_FORBIDDEN');
    }

    const deactivatedUser = await withTransaction(async (client) => {
        const userCheck = await client.query('SELECT role, active, email FROM users WHERE id = $1', [req.params.id]);
        const userToDeactivate = userCheck.rows[0];
        if (!userToDeactivate) {
            throw new AppError(404, 'ไม่พบผู้ใช้', 'USER_NOT_FOUND');
        }
        if (!userToDeactivate.active) {
            throw new AppError(400, 'ผู้ใช้นี้ถูกปิดใช้งานอยู่แล้ว', 'USER_ALREADY_INACTIVE');
        }

        if (userToDeactivate.role === 'admin') {
            const adminCount = await client.query("SELECT COUNT(*)::integer AS count FROM users WHERE role = 'admin' AND active = TRUE AND id <> $1", [req.params.id]);
            if (adminCount.rows[0].count === 0) {
                throw new AppError(400, 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน', 'LAST_ADMIN_DEACTIVATE_FORBIDDEN');
            }
        }

        const result = await client.query(
            `UPDATE users
             SET active = FALSE, updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, email, role, active`,
            [req.params.id]
        );

        await writeAudit(client, {
            userId: req.user.id,
            action: 'DEACTIVATE',
            entityType: 'user',
            entityId: req.params.id,
            details: { email: userToDeactivate.email, reason: req.body.reason }
        });

        return result.rows[0];
    }, { name: 'user.deactivate' });

    res.json({ data: deactivatedUser });
}));

router.patch('/:id/restore', validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    const restoredUser = await withTransaction(async (client) => {
        const userCheck = await client.query('SELECT active, email FROM users WHERE id = $1', [req.params.id]);
        const userToRestore = userCheck.rows[0];
        if (!userToRestore) {
            throw new AppError(404, 'ไม่พบผู้ใช้', 'USER_NOT_FOUND');
        }
        if (userToRestore.active) {
            throw new AppError(400, 'ผู้ใช้นี้เปิดใช้งานอยู่แล้ว', 'USER_ALREADY_ACTIVE');
        }

        const result = await client.query(
            `UPDATE users
             SET active = TRUE, updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, email, role, active`,
            [req.params.id]
        );

        await writeAudit(client, {
            userId: req.user.id,
            action: 'RESTORE',
            entityType: 'user',
            entityId: req.params.id,
            details: { email: userToRestore.email }
        });

        return result.rows[0];
    }, { name: 'user.restore' });

    res.json({ data: restoredUser });
}));

module.exports = router;
