const AppError = require('../utils/app-error');

const REQUIRED_TABLES = [
    'users',
    'customers',
    'products',
    'settings',
    'document_counters',
    'documents',
    'document_items',
    'document_relations',
    'document_signatures',
    'audit_logs'
];

const REQUIRED_COLUMNS = {
    users: ['id', 'name', 'email', 'password_hash', 'role', 'active', 'created_at', 'updated_at'],
    customers: ['id', 'code', 'name', 'customer_type', 'tax_id', 'branch_name', 'address', 'email', 'phone', 'withholding_enabled', 'withholding_rate', 'withholding_basis', 'withholding_threshold', 'receipt_transfer_fee', 'active', 'deactivated_at', 'deactivated_by', 'deactivation_reason', 'created_at', 'updated_at'],
    products: ['id', 'sku', 'name', 'item_type', 'unit', 'price', 'category', 'active', 'deactivated_at', 'deactivated_by', 'deactivation_reason', 'created_at', 'updated_at'],
    settings: ['id', 'shop_name_th', 'shop_name_en', 'shop_owner', 'shop_address', 'shop_tax_id', 'shop_phone', 'shop_email', 'scb_bank_details', 'ktb_bank_details', 'logo_url', 'saved_signature_url', 'numbering_config', 'feature_flags', 'updated_at'],
    document_counters: ['document_type', 'period_key', 'last_number', 'updated_at'],
    documents: [
        'id', 'document_number', 'document_type', 'status', 'document_date', 'due_date',
        'customer_id', 'customer_snapshot', 'product_subtotal', 'service_subtotal',
        'other_subtotal', 'subtotal', 'discount', 'grand_total', 'withholding_rate',
        'withholding_base', 'withholding_amount', 'transfer_fee', 'net_total',
        'remarks', 'payment_terms', 'delivery_days', 'quotation_validity_days',
        'created_by', 'updated_by', 'cancelled_at', 'cancelled_by',
        'cancellation_reason', 'deleted_at', 'deleted_by', 'deletion_reason',
        'withholding_is_actual', 'payment_received_date',
        'withholding_certificate_number', 'withholding_certificate_date',
        'show_signature', 'created_at', 'updated_at'
    ],
    document_items: ['id', 'document_id', 'sort_order', 'line_type', 'item_type', 'product_id', 'description', 'quantity', 'unit', 'unit_price', 'line_total', 'text_style', 'created_at'],
    document_relations: ['id', 'source_document_id', 'target_document_id', 'relation_type', 'created_at'],
    document_signatures: ['id', 'document_id', 'role', 'signer_name', 'signature_url', 'signed_at', 'created_at'],
    audit_logs: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'details', 'created_at']
};

const REQUIRED_DOCUMENT_COLUMNS = REQUIRED_COLUMNS.documents;

let schemaReady = false;

async function getSchemaStatus(client) {
    const tablesResult = await client.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
           AND table_name = ANY($1::text[])`,
        [REQUIRED_TABLES]
    );

    const foundTables = new Set(tablesResult.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((table) => !foundTables.has(table));

    const columnsResult = await client.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [REQUIRED_TABLES]
    );

    const foundColumns = new Map();
    for (const row of columnsResult.rows) {
        if (!foundColumns.has(row.table_name)) foundColumns.set(row.table_name, new Set());
        foundColumns.get(row.table_name).add(row.column_name);
    }

    const missingColumns = {};
    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
        const found = foundColumns.get(table) || new Set();
        const missing = required.filter((column) => !found.has(column));
        if (missing.length) missingColumns[table] = missing;
    }

    return {
        ready: missingTables.length === 0 && Object.keys(missingColumns).length === 0,
        required_tables: REQUIRED_TABLES,
        missing_tables: missingTables,
        required_columns: REQUIRED_COLUMNS,
        missing_columns: missingColumns
    };
}

async function getDocumentSchemaStatus(client) {
    const status = await getSchemaStatus(client);
    const missing = status.missing_columns.documents || [];

    return {
        ready: !status.missing_tables.includes('documents') && missing.length === 0,
        required: REQUIRED_DOCUMENT_COLUMNS,
        missing,
        missing_tables: status.missing_tables
    };
}

async function assertDocumentSchemaReady(client) {
    if (schemaReady) return;

    const status = await getDocumentSchemaStatus(client);
    if (!status.ready) {
        throw new AppError(
            503,
            'ฐานข้อมูลยังไม่พร้อมสำหรับระบบเอกสารเวอร์ชันนี้ กรุณารัน Database Migration ให้ครบก่อน',
            'DOCUMENT_SCHEMA_OUTDATED',
            { missing_tables: status.missing_tables, missing_columns: status.missing }
        );
    }

    schemaReady = true;
}

module.exports = {
    REQUIRED_TABLES,
    REQUIRED_COLUMNS,
    REQUIRED_DOCUMENT_COLUMNS,
    getSchemaStatus,
    getDocumentSchemaStatus,
    assertDocumentSchemaReady
};
