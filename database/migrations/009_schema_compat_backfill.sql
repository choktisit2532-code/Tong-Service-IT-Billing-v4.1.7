-- v4.1.7 Production compatibility migration
-- Purpose: repair databases that were created from older/incomplete schemas.
-- This file is intentionally idempotent and does not delete business data.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40),
    name VARCHAR(180) NOT NULL,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'general',
    tax_id VARCHAR(30),
    branch_name VARCHAR(120),
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(40),
    withholding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 3,
    withholding_basis VARCHAR(20) NOT NULL DEFAULT 'full',
    withholding_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
    receipt_transfer_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(60),
    name VARCHAR(220) NOT NULL,
    item_type VARCHAR(20) NOT NULL DEFAULT 'service',
    unit VARCHAR(50) NOT NULL DEFAULT 'งาน',
    price NUMERIC(14,2) NOT NULL DEFAULT 0,
    category VARCHAR(120),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS document_counters (
    document_type VARCHAR(2) NOT NULL,
    period_key VARCHAR(20) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_type, period_key)
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    document_number VARCHAR(80) NOT NULL UNIQUE,
    document_type VARCHAR(2) NOT NULL DEFAULT 'QT',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id BIGINT,
    customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_items (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT,
    sort_order INTEGER NOT NULL DEFAULT 1,
    line_type VARCHAR(20) NOT NULL DEFAULT 'item',
    description TEXT NOT NULL DEFAULT '',
    line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_relations (
    id BIGSERIAL PRIMARY KEY,
    source_document_id BIGINT,
    target_document_id BIGINT,
    relation_type VARCHAR(30) NOT NULL DEFAULT 'CONVERTED_TO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_signatures (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT,
    role VARCHAR(40) NOT NULL DEFAULT 'issuer',
    signer_name VARCHAR(200),
    signature_url TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'viewer',
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE users SET role = 'viewer' WHERE role IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email));

-- Customers
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS code VARCHAR(40),
    ADD COLUMN IF NOT EXISTS name VARCHAR(180),
    ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS tax_id VARCHAR(30),
    ADD COLUMN IF NOT EXISTS branch_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS withholding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS withholding_basis VARCHAR(20) NOT NULL DEFAULT 'full',
    ADD COLUMN IF NOT EXISTS withholding_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS receipt_transfer_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deactivated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS customers_code_unique ON customers (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_name_index ON customers (name);
CREATE INDEX IF NOT EXISTS customers_type_index ON customers (customer_type);
CREATE INDEX IF NOT EXISTS customers_active_name_index ON customers (name) WHERE active = TRUE;

-- Products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sku VARCHAR(60),
    ADD COLUMN IF NOT EXISTS name VARCHAR(220),
    ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'service',
    ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT 'งาน',
    ADD COLUMN IF NOT EXISTS price NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS category VARCHAR(120),
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deactivated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON products (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_name_index ON products (name);
CREATE INDEX IF NOT EXISTS products_item_type_index ON products (item_type);
CREATE INDEX IF NOT EXISTS products_active_name_index ON products (name) WHERE active = TRUE;

-- Settings
ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS shop_name_th VARCHAR(200) NOT NULL DEFAULT 'ต้อง เซอร์วิส ไอที',
    ADD COLUMN IF NOT EXISTS shop_name_en VARCHAR(200) NOT NULL DEFAULT 'Tong Service IT',
    ADD COLUMN IF NOT EXISTS shop_owner VARCHAR(200),
    ADD COLUMN IF NOT EXISTS shop_address TEXT,
    ADD COLUMN IF NOT EXISTS shop_tax_id VARCHAR(30),
    ADD COLUMN IF NOT EXISTS shop_phone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS shop_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS scb_bank_details TEXT,
    ADD COLUMN IF NOT EXISTS ktb_bank_details TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS saved_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS numbering_config JSONB NOT NULL DEFAULT '{
      "QT":{"prefix":"QT","digits":3,"period":"BYYMM","separator":"-"},
      "IN":{"prefix":"IN","digits":3,"period":"BYYMM","separator":"-"},
      "BN":{"prefix":"BN","digits":3,"period":"BYYMM","separator":"-"},
      "RC":{"prefix":"RC","digits":3,"period":"BYYMM","separator":"-"},
      "DO":{"prefix":"DO","digits":3,"period":"BYYMM","separator":"-"}
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{
      "realtime":false,
      "automatic_backup":false,
      "email_notifications":false
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Documents
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(2) NOT NULL DEFAULT 'QT',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS customer_id BIGINT,
    ADD COLUMN IF NOT EXISTS customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS product_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS service_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS other_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withholding_base NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transfer_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS payment_terms TEXT,
    ADD COLUMN IF NOT EXISTS delivery_days INTEGER,
    ADD COLUMN IF NOT EXISTS quotation_validity_days INTEGER,
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by BIGINT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
    ADD COLUMN IF NOT EXISTS withholding_is_actual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_received_date DATE,
    ADD COLUMN IF NOT EXISTS withholding_certificate_number VARCHAR(120),
    ADD COLUMN IF NOT EXISTS withholding_certificate_date DATE,
    ADD COLUMN IF NOT EXISTS show_signature BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE documents
SET document_number = CONCAT('LEGACY-', id)
WHERE document_number IS NULL OR btrim(document_number) = '';

CREATE UNIQUE INDEX IF NOT EXISTS documents_document_number_unique ON documents (document_number);
CREATE INDEX IF NOT EXISTS documents_type_index ON documents (document_type);
CREATE INDEX IF NOT EXISTS documents_status_index ON documents (status);
CREATE INDEX IF NOT EXISTS documents_date_index ON documents (document_date DESC);
CREATE INDEX IF NOT EXISTS documents_customer_index ON documents (customer_id);
CREATE INDEX IF NOT EXISTS documents_active_list_index ON documents (document_date DESC, id DESC) WHERE deleted_at IS NULL;

-- Document items
ALTER TABLE document_items
    ADD COLUMN IF NOT EXISTS document_id BIGINT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS line_type VARCHAR(20) NOT NULL DEFAULT 'item',
    ADD COLUMN IF NOT EXISTS item_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS product_id BIGINT,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS text_style VARCHAR(20) NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS document_items_document_index ON document_items (document_id, sort_order);

-- Document relations
ALTER TABLE document_relations
    ADD COLUMN IF NOT EXISTS source_document_id BIGINT,
    ADD COLUMN IF NOT EXISTS target_document_id BIGINT,
    ADD COLUMN IF NOT EXISTS relation_type VARCHAR(30) NOT NULL DEFAULT 'CONVERTED_TO',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS document_relations_unique_relation
    ON document_relations (source_document_id, target_document_id, relation_type)
    WHERE source_document_id IS NOT NULL AND target_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_relations_source_index ON document_relations (source_document_id);
CREATE INDEX IF NOT EXISTS document_relations_target_index ON document_relations (target_document_id);

-- Signatures
ALTER TABLE document_signatures
    ADD COLUMN IF NOT EXISTS document_id BIGINT,
    ADD COLUMN IF NOT EXISTS role VARCHAR(40) NOT NULL DEFAULT 'issuer',
    ADD COLUMN IF NOT EXISTS signer_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS signature_url TEXT,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS document_signatures_document_index ON document_signatures (document_id);

-- Audit logs
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS user_id BIGINT,
    ADD COLUMN IF NOT EXISTS action VARCHAR(60),
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(60),
    ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS audit_logs_entity_index ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_index ON audit_logs (created_at DESC);

-- Re-apply current status constraint safely.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents
    ADD CONSTRAINT documents_status_check
    CHECK (status IN ('DRAFT','PENDING','APPROVED','IN_PROGRESS','REJECTED','PAID','CANCELLED','OVERDUE'));

-- Safe FK backfill. These are optional because legacy databases may have dirty rows.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_customer_id_fkey')
       AND NOT EXISTS (
           SELECT 1 FROM documents d
           WHERE d.customer_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = d.customer_id)
       )
    THEN
        ALTER TABLE documents ADD CONSTRAINT documents_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_items_document_id_fkey')
       AND NOT EXISTS (
           SELECT 1 FROM document_items di
           WHERE di.document_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = di.document_id)
       )
    THEN
        ALTER TABLE document_items ADD CONSTRAINT document_items_document_id_fkey
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Customer code backfill for legacy rows.
SELECT pg_advisory_xact_lock(hashtext('customers.code.autonumber'));
DO $$
DECLARE
    customer_record RECORD;
    next_number INTEGER;
    next_code TEXT;
BEGIN
    SELECT COALESCE(MAX(code::integer), 0) + 1
      INTO next_number
      FROM customers
     WHERE code ~ '^[0-9]+$';

    FOR customer_record IN
        SELECT id
          FROM customers
         WHERE code IS NULL OR btrim(code) = ''
         ORDER BY id
         FOR UPDATE
    LOOP
        LOOP
            next_code := lpad(next_number::text, 4, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM customers WHERE code = next_code);
            next_number := next_number + 1;
        END LOOP;

        UPDATE customers SET code = next_code, updated_at = NOW() WHERE id = customer_record.id;
        next_number := next_number + 1;
    END LOOP;
END $$;

-- Trigger backfill
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS settings_set_updated_at ON settings;
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
