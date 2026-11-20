const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { repairTicketCreateSchema, repairTicketUpdateSchema, paginationSchema } = require('../validators/schemas');
const { formatPeriod, formatDocumentNumber } = require('../utils/document-number');

const router = express.Router();

router.use(authenticate);

async function nextRepairNumber(client, ticketDate) {
    const periodKey = formatPeriod(ticketDate, 'BYYMM');
    const type = 'RP';
    const result = await client.query(
        `INSERT INTO document_counters (document_type, period_key, last_number)
         VALUES ($1, $2, 1)
         ON CONFLICT (document_type, period_key)
         DO UPDATE SET last_number = document_counters.last_number + 1, updated_at = NOW()
         RETURNING last_number`,
        [type, periodKey]
    );
    const sequence = result.rows[0].last_number;
    return formatDocumentNumber({
        config: { prefix: 'RP', digits: 3, period: 'BYYMM', separator: '-' },
        sequence,
        periodKey
    });
}

// GET /api/repairs - รายการงานรับซ่อม
router.get('/', asyncHandler(async (req, res) => {
    const { search = '', status = 'all', page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
        params.push(status);
        where += ` AND r.status = $${params.length}`;
    }

    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        const idx = params.length;
        where += ` AND (
            r.ticket_number ILIKE $${idx} OR
            r.brand_model ILIKE $${idx} OR
            r.serial_number ILIKE $${idx} OR
            r.symptoms ILIKE $${idx} OR
            c.name ILIKE $${idx} OR
            c.phone ILIKE $${idx}
        )`;
    }

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM repair_tickets r
        JOIN customers c ON c.id = r.customer_id
        ${where}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    const dataQuery = `
        SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.customer_type
        FROM repair_tickets r
        JOIN customers c ON c.id = r.customer_id
        ${where}
        ORDER BY r.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

    res.json({
        data: dataResult.rows,
        pagination: { page: Number(page), limit: Number(limit), total }
    });
}));

// GET /api/repairs/:id - รายละเอียดใบรับซ่อม
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               c.address AS customer_address, c.customer_type, u.name AS creator_name
        FROM repair_tickets r
        JOIN customers c ON c.id = r.customer_id
        JOIN users u ON u.id = r.created_by
        WHERE r.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (!result.rows[0]) throw new AppError(404, 'ไม่พบข้อมูลใบรับเครื่องซ่อม', 'NOT_FOUND');
    res.json({ data: result.rows[0] });
}));

// POST /api/repairs - สร้างใบรับเครื่องซ่อมใหม่
router.post('/', authorize('document.create'), validate(repairTicketCreateSchema), asyncHandler(async (req, res) => {
    const b = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ตรวจสอบและดึงข้อมูลลูกค้า
        const customerResult = await client.query('SELECT * FROM customers WHERE id = $1', [b.customer_id]);
        const customer = customerResult.rows[0];
        if (!customer) throw new AppError(404, 'ไม่พบข้อมูลลูกค้าที่เลือก', 'CUSTOMER_NOT_FOUND');

        const customerSnapshot = {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            email: customer.email,
            customer_type: customer.customer_type
        };

        const ticketNumber = await nextRepairNumber(client, b.ticket_date);

        const insertQuery = `
            INSERT INTO repair_tickets (
                ticket_number, ticket_date, customer_id, customer_snapshot,
                device_type, brand_model, serial_number, passcode,
                accessories, symptoms, physical_condition, is_subcontract,
                subcontract_reason, estimated_cost, deposit_amount, status,
                technician_notes, appointment_date, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'PENDING', $16, $17, $18
            ) RETURNING *
        `;
        const insertParams = [
            ticketNumber, b.ticket_date, customer.id, JSON.stringify(customerSnapshot),
            b.device_type, b.brand_model, b.serial_number || null, b.passcode || null,
            b.accessories || null, b.symptoms, b.physical_condition || null, b.is_subcontract ?? true,
            b.subcontract_reason || 'มีอาการเสียเกี่ยวกับระบบวงจรไฟฟ้า/เมนบอร์ดขั้นสูง จำเป็นต้องใช้เครื่องมือและช่างเฉพาะทาง',
            b.estimated_cost || 0, b.deposit_amount || 0,
            b.technician_notes || null, b.appointment_date || null, req.user.id
        ];

        const ticketResult = await client.query(insertQuery, insertParams);
        await client.query('COMMIT');
        res.status(201).json({ data: ticketResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// PUT /api/repairs/:id - แก้ไขใบรับเครื่องซ่อม / เปลี่ยนสถานะ
router.put('/:id', authorize('document.create'), validate(repairTicketUpdateSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingResult = await client.query('SELECT * FROM repair_tickets WHERE id = $1', [id]);
        const existing = existingResult.rows[0];
        if (!existing) throw new AppError(404, 'ไม่พบข้อมูลใบรับเครื่องซ่อม', 'NOT_FOUND');

        let customerSnapshot = existing.customer_snapshot;
        if (b.customer_id && b.customer_id !== existing.customer_id) {
            const custRes = await client.query('SELECT * FROM customers WHERE id = $1', [b.customer_id]);
            if (custRes.rows[0]) {
                customerSnapshot = {
                    id: custRes.rows[0].id,
                    name: custRes.rows[0].name,
                    phone: custRes.rows[0].phone,
                    address: custRes.rows[0].address,
                    email: custRes.rows[0].email,
                    customer_type: custRes.rows[0].customer_type
                };
            }
        }

        const updateQuery = `
            UPDATE repair_tickets SET
                customer_id = COALESCE($1, customer_id),
                customer_snapshot = $2,
                device_type = COALESCE($3, device_type),
                brand_model = COALESCE($4, brand_model),
                serial_number = $5,
                passcode = $6,
                accessories = $7,
                symptoms = COALESCE($8, symptoms),
                physical_condition = $9,
                is_subcontract = COALESCE($10, is_subcontract),
                subcontract_reason = COALESCE($11, subcontract_reason),
                estimated_cost = COALESCE($12, estimated_cost),
                deposit_amount = COALESCE($13, deposit_amount),
                status = COALESCE($14, status),
                technician_notes = $15,
                appointment_date = $16,
                updated_at = NOW()
            WHERE id = $17
            RETURNING *
        `;
        const updateParams = [
            b.customer_id || existing.customer_id,
            JSON.stringify(customerSnapshot),
            b.device_type || existing.device_type,
            b.brand_model || existing.brand_model,
            b.serial_number !== undefined ? b.serial_number : existing.serial_number,
            b.passcode !== undefined ? b.passcode : existing.passcode,
            b.accessories !== undefined ? b.accessories : existing.accessories,
            b.symptoms || existing.symptoms,
            b.physical_condition !== undefined ? b.physical_condition : existing.physical_condition,
            b.is_subcontract !== undefined ? b.is_subcontract : existing.is_subcontract,
            b.subcontract_reason !== undefined ? b.subcontract_reason : existing.subcontract_reason,
            b.estimated_cost !== undefined ? b.estimated_cost : existing.estimated_cost,
            b.deposit_amount !== undefined ? b.deposit_amount : existing.deposit_amount,
            b.status || existing.status,
            b.technician_notes !== undefined ? b.technician_notes : existing.technician_notes,
            b.appointment_date !== undefined ? b.appointment_date : existing.appointment_date,
            id
        ];

        const result = await client.query(updateQuery, updateParams);
        await client.query('COMMIT');
        res.json({ data: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// DELETE /api/repairs/:id - ลบใบรับซ่อม
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM repair_tickets WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new AppError(404, 'ไม่พบข้อมูลใบรับเครื่องซ่อม', 'NOT_FOUND');
    res.json({ success: true, message: 'ลบใบรับซ่อมเรียบร้อย' });
}));

module.exports = router;
