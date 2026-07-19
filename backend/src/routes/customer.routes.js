const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/db-transaction');
const { writeAudit } = require('../services/audit.service');
const {
    customerSchema,
    idSchema,
    masterDataListSchema,
    documentReasonSchema
} = require('../validators/schemas');
const { clearCache } = require('../utils/cache');


async function generateNextCustomerCode(client) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('customers.code.autonumber'))");
    const result = await client.query(`
        SELECT COALESCE(MAX(code::integer), 0) + 1 AS next_number
        FROM customers
        WHERE code ~ '^[0-9]+$'
    `);
    const nextNumber = Number(result.rows[0]?.next_number || 1);
    return String(nextNumber).padStart(4, '0');
}

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('customer.view'), validate(masterDataListSchema, 'query'), asyncHandler(async (req, res) => {
    const { search, page, limit, status } = req.query;
    const offset = (page - 1) * limit;
    const pattern = `%${search}%`;
    const statusCondition = `(
        $3 = 'all'
        OR ($3 = 'active' AND active = TRUE)
        OR ($3 = 'inactive' AND active = FALSE)
    )`;

    const [result, count] = await Promise.all([
        pool.query(
            `SELECT * FROM customers
             WHERE ${statusCondition}
               AND ($1 = '' OR name ILIKE $2 OR COALESCE(code, '') ILIKE $2 OR COALESCE(tax_id, '') ILIKE $2)
             ORDER BY active DESC, name
             LIMIT $4 OFFSET $5`,
            [search, pattern, status, limit, offset]
        ),
        pool.query(
            `SELECT COUNT(*)::integer AS total
             FROM customers
             WHERE ${statusCondition}
               AND ($1 = '' OR name ILIKE $2 OR COALESCE(code, '') ILIKE $2 OR COALESCE(tax_id, '') ILIKE $2)`,
            [search, pattern, status]
        )
    ]);

    res.json({ data: result.rows, pagination: { page, limit, total: count.rows[0].total } });
}));

router.get('/:id', authorize('customer.view'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) throw new AppError(404, 'ไม่พบลูกค้า', 'CUSTOMER_NOT_FOUND');
    res.json({ data: result.rows[0] });
}));

router.post('/', authorize('customer.create'), validate(customerSchema), asyncHandler(async (req, res) => {
    const createdCustomer = await withTransaction(async (client) => {
        const b = req.body;
        const customerCode = await generateNextCustomerCode(client);
        const result = await client.query(
            `INSERT INTO customers (
                code, name, customer_type, tax_id, branch_name, address, email, phone,
                withholding_enabled, withholding_rate, withholding_basis,
                withholding_threshold, receipt_transfer_fee, active
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
             RETURNING *`,
            [
                customerCode, b.name, b.customer_type, b.tax_id, b.branch_name, b.address, b.email, b.phone,
                b.withholding_enabled, b.withholding_rate, b.withholding_basis,
                b.withholding_threshold, b.receipt_transfer_fee
            ]
        );

        await writeAudit(client, {
            userId: req.user.id,
            action: 'CREATE',
            entityType: 'customer',
            entityId: result.rows[0].id,
            details: { name: b.name, code: result.rows[0].code, customer_type: b.customer_type }
        });

        return result.rows[0];
    }, { name: 'customer.create' });
    clearCache('dashboard:');

    res.status(201).json({ data: createdCustomer });
}));

router.put('/:id', authorize('customer.update'), validate(idSchema, 'params'), validate(customerSchema), asyncHandler(async (req, res) => {
    const updatedCustomer = await withTransaction(async (client) => {
        const beforeResult = await client.query('SELECT * FROM customers WHERE id = $1 FOR UPDATE', [req.params.id]);
        const before = beforeResult.rows[0];
        if (!before) throw new AppError(404, 'ไม่พบลูกค้า', 'CUSTOMER_NOT_FOUND');
        if (!before.active) {
            throw new AppError(409, 'ลูกค้ารายนี้ถูกปิดใช้งานแล้ว กรุณากู้คืนก่อนแก้ไข', 'CUSTOMER_INACTIVE');
        }

        const b = req.body;
        const customerCode = before.code || (await generateNextCustomerCode(client));
        const result = await client.query(
            `UPDATE customers SET
                code = $1,
                name = $2,
                customer_type = $3,
                tax_id = $4,
                branch_name = $5,
                address = $6,
                email = $7,
                phone = $8,
                withholding_enabled = $9,
                withholding_rate = $10,
                withholding_basis = $11,
                withholding_threshold = $12,
                receipt_transfer_fee = $13
             WHERE id = $14
             RETURNING *`,
            [
                customerCode, b.name, b.customer_type, b.tax_id, b.branch_name, b.address, b.email, b.phone,
                b.withholding_enabled, b.withholding_rate, b.withholding_basis, b.withholding_threshold,
                b.receipt_transfer_fee, req.params.id
            ]
        );
        const after = result.rows[0];

        await writeAudit(client, {
            userId: req.user.id,
            action: 'UPDATE',
            entityType: 'customer',
            entityId: after.id,
            details: {
                before: { name: before.name, code: before.code, customer_type: before.customer_type, tax_id: before.tax_id },
                after: { name: after.name, code: after.code, customer_type: after.customer_type, tax_id: after.tax_id }
            }
        });

        return after;
    }, { name: 'customer.update' });
    clearCache('dashboard:');

    res.json({ data: updatedCustomer });
}));

router.post('/:id/deactivate', authorize('customer.deactivate'), validate(idSchema, 'params'), validate(documentReasonSchema), asyncHandler(async (req, res) => {
    const deactivatedCustomer = await withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE customers SET
                active = FALSE,
                deactivated_at = NOW(),
                deactivated_by = $2,
                deactivation_reason = $3
             WHERE id = $1 AND active = TRUE
             RETURNING *`,
            [req.params.id, req.user.id, req.body.reason]
        );

        if (!result.rows[0]) {
            const exists = await client.query('SELECT id, active FROM customers WHERE id = $1', [req.params.id]);
            if (!exists.rows[0]) throw new AppError(404, 'ไม่พบลูกค้า', 'CUSTOMER_NOT_FOUND');
            throw new AppError(409, 'ลูกค้ารายนี้ถูกปิดใช้งานอยู่แล้ว', 'CUSTOMER_ALREADY_INACTIVE');
        }

        await writeAudit(client, {
            userId: req.user.id,
            action: 'DEACTIVATE',
            entityType: 'customer',
            entityId: result.rows[0].id,
            details: { name: result.rows[0].name, reason: req.body.reason }
        });

        return result.rows[0];
    }, { name: 'customer.deactivate' });
    clearCache('dashboard:');

    res.json({ data: deactivatedCustomer });
}));

router.post('/:id/restore', authorize('customer.restore'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    const restoredCustomer = await withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE customers SET
                active = TRUE,
                deactivated_at = NULL,
                deactivated_by = NULL,
                deactivation_reason = NULL
             WHERE id = $1 AND active = FALSE
             RETURNING *`,
            [req.params.id]
        );

        if (!result.rows[0]) {
            const exists = await client.query('SELECT id, active FROM customers WHERE id = $1', [req.params.id]);
            if (!exists.rows[0]) throw new AppError(404, 'ไม่พบลูกค้า', 'CUSTOMER_NOT_FOUND');
            throw new AppError(409, 'ลูกค้ารายนี้เปิดใช้งานอยู่แล้ว', 'CUSTOMER_ALREADY_ACTIVE');
        }

        await writeAudit(client, {
            userId: req.user.id,
            action: 'RESTORE',
            entityType: 'customer',
            entityId: result.rows[0].id,
            details: { name: result.rows[0].name }
        });

        return result.rows[0];
    }, { name: 'customer.restore' });
    clearCache('dashboard:');

    res.json({ data: restoredCustomer });
}));

module.exports = router;
