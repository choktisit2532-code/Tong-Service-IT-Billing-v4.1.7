const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/db-transaction');
const { writeAudit } = require('../services/audit.service');

const router = express.Router();
router.use(authenticate);

const backupTables = ['customers','products','settings','documents','document_items','document_relations','document_signatures','audit_logs'];
const resetTables = {
    documents_only: ['document_signatures', 'document_relations', 'document_items', 'documents', 'document_counters'],
    documents_audit: ['document_signatures', 'document_relations', 'document_items', 'documents', 'document_counters', 'audit_logs'],
    business_data: ['document_signatures', 'document_relations', 'document_items', 'documents', 'document_counters', 'customers', 'products', 'audit_logs']
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 }
});

async function buildBackup(client = pool) {
    const backup = { version: 3, exported_at: new Date().toISOString(), tables: backupTables, data: {} };
    for (const table of backupTables) {
        const result = await client.query(`SELECT * FROM ${table} ORDER BY 1`);
        backup.data[table] = result.rows;
    }
    return backup;
}

router.get('/export', authorize('backup.export'), asyncHandler(async (_req, res) => {
    const backup = await buildBackup();
    res.setHeader('Content-Disposition', `attachment; filename="tong-billing-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(backup);
}));

function normalizeBackupPayload(file) {
    if (!file) throw new AppError(400, 'กรุณาเลือกไฟล์ backup JSON', 'BACKUP_FILE_REQUIRED');
    let parsed;
    try {
        parsed = JSON.parse(file.buffer.toString('utf8'));
    } catch {
        throw new AppError(400, 'ไฟล์ backup ไม่ใช่ JSON ที่ถูกต้อง', 'INVALID_BACKUP_JSON');
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        throw new AppError(400, 'รูปแบบไฟล์ backup ไม่ถูกต้อง', 'INVALID_BACKUP_FORMAT');
    }
    return parsed;
}

const TABLE_ALLOWED_COLUMNS = {
    customers: new Set([
        'id', 'code', 'name', 'customer_type', 'tax_id', 'branch_name', 'address', 'email', 'phone',
        'withholding_enabled', 'withholding_rate', 'withholding_basis', 'withholding_threshold',
        'receipt_transfer_fee', 'active', 'created_at', 'updated_at', 'deactivated_at', 'deactivated_by', 'deactivation_reason'
    ]),
    products: new Set([
        'id', 'sku', 'name', 'item_type', 'unit', 'price', 'category', 'active', 'created_at', 'updated_at',
        'deactivated_at', 'deactivated_by', 'deactivation_reason'
    ]),
    settings: new Set([
        'id', 'shop_name_th', 'shop_name_en', 'shop_owner', 'shop_address', 'shop_tax_id', 'shop_phone', 'shop_email',
        'scb_bank_details', 'ktb_bank_details', 'logo_url', 'saved_signature_url', 'numbering_config', 'feature_flags', 'updated_at'
    ]),
    documents: new Set([
        'id', 'document_number', 'document_type', 'status', 'document_date', 'due_date', 'customer_id', 'customer_snapshot',
        'product_subtotal', 'service_subtotal', 'other_subtotal', 'subtotal', 'discount', 'grand_total', 'withholding_rate',
        'withholding_base', 'withholding_amount', 'transfer_fee', 'net_total', 'remarks', 'payment_terms', 'delivery_days',
        'quotation_validity_days', 'created_by', 'updated_by', 'created_at', 'updated_at', 'cancelled_at', 'cancelled_by',
        'cancellation_reason', 'deleted_at', 'deleted_by', 'deletion_reason', 'withholding_is_actual', 'payment_received_date',
        'withholding_certificate_number', 'withholding_certificate_date', 'show_signature'
    ]),
    document_items: new Set([
        'id', 'document_id', 'sort_order', 'line_type', 'item_type', 'product_id', 'description', 'quantity', 'unit',
        'unit_price', 'line_total', 'text_style', 'created_at'
    ]),
    document_relations: new Set([
        'id', 'source_document_id', 'target_document_id', 'relation_type', 'created_at'
    ]),
    document_signatures: new Set([
        'id', 'document_id', 'role', 'signer_name', 'signature_url', 'signed_at', 'created_at'
    ]),
    audit_logs: new Set([
        'id', 'user_id', 'action', 'entity_type', 'entity_id', 'details', 'created_at'
    ])
};

router.post('/restore', authorize('user.manage'), upload.single('backup'), asyncHandler(async (req, res) => {
    const backup = normalizeBackupPayload(req.file);
    const restored = await withTransaction(async (client) => {
        await client.query('SET CONSTRAINTS ALL DEFERRED');
        for (const table of [...backupTables].reverse()) {
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }
        for (const table of backupTables) {
            const rows = Array.isArray(backup.data[table]) ? backup.data[table] : [];
            for (const row of rows) {
                const columns = Object.keys(row);
                if (!columns.length) continue;
                for (const column of columns) {
                    if (!TABLE_ALLOWED_COLUMNS[table] || !TABLE_ALLOWED_COLUMNS[table].has(column)) {
                        throw new AppError(400, `ไฟล์ backup มีคอลัมน์ที่ไม่ได้รับอนุญาต: ${table}.${column}`, 'INVALID_BACKUP_COLUMN');
                    }
                }
                const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
                const quoted = columns.map((column) => `"${column.replace(/"/g, '""')}"`).join(',');
                await client.query(
                    `INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`,
                    columns.map((column) => row[column])
                );
            }
        }
        return Object.fromEntries(backupTables.map((table) => [table, Array.isArray(backup.data[table]) ? backup.data[table].length : 0]));
    }, { name: 'backup.restore' });

    res.json({ data: { restored, restored_at: new Date().toISOString() } });
}));

function resetPlanLabel(mode) {
    return {
        documents_only: 'เคลียร์เฉพาะเอกสาร',
        documents_audit: 'เคลียร์เอกสารและ Audit Log',
        business_data: 'เคลียร์เอกสาร ลูกค้า สินค้า/บริการ และ Audit Log'
    }[mode] || mode;
}

function validateResetRequest(body = {}) {
    const mode = body.mode || 'documents_only';
    if (!resetTables[mode]) {
        throw new AppError(400, 'โหมดเคลียร์ข้อมูลไม่ถูกต้อง', 'INVALID_RESET_MODE');
    }
    if (body.confirmation !== 'RESET') {
        throw new AppError(400, 'กรุณาพิมพ์ RESET เพื่อยืนยันการเคลียร์ข้อมูล', 'RESET_CONFIRMATION_REQUIRED');
    }
    return {
        mode,
        reason: String(body.reason || '').trim() || 'admin data reset'
    };
}

router.post('/reset', authorize('user.manage'), asyncHandler(async (req, res) => {
    const { mode, reason } = validateResetRequest(req.body);
    const result = await withTransaction(async (client) => {
        const backup = await buildBackup(client);
        const tableCounts = {};
        const tables = resetTables[mode];

        for (const table of tables) {
            const countResult = await client.query(`SELECT COUNT(*)::integer AS count FROM ${table}`);
            tableCounts[table] = countResult.rows[0].count;
        }

        await client.query('SET CONSTRAINTS ALL DEFERRED');
        for (const table of tables) {
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }

        await writeAudit(client, {
            userId: req.user.id,
            action: 'ADMIN_DATA_RESET',
            entityType: 'system',
            entityId: mode,
            details: {
                mode,
                mode_label: resetPlanLabel(mode),
                reason,
                cleared_tables: tables,
                table_counts: tableCounts,
                backup_exported_at: backup.exported_at
            }
        });

        return {
            mode,
            mode_label: resetPlanLabel(mode),
            reason,
            cleared_tables: tables,
            table_counts: tableCounts,
            backup
        };
    }, { name: 'admin.data_reset' });

    res.setHeader('Content-Disposition', `attachment; filename="tong-billing-before-reset-${result.mode}-${new Date().toISOString().slice(0,10)}.json"`);
    res.json({ data: result });
}));

module.exports = router;
