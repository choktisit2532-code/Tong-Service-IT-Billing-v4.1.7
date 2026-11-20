-- Migration 015: Serial Number, Warranty, and Repair Tickets with Subcontracting Consent
BEGIN;

-- 1. เพิ่มฟิลด์ S/N และระยะเวลารับประกันในรายการสินค้า/บริการ (document_items)
ALTER TABLE document_items
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS warranty_period VARCHAR(100);

COMMENT ON COLUMN document_items.serial_number IS 'เลข Serial Number ของสินค้าหรือชิ้นส่วน (S/N)';
COMMENT ON COLUMN document_items.warranty_period IS 'ระยะเวลารับประกัน เช่น 1 ปี, 3 เดือน, ถึง 20/11/2570';

-- 2. สร้างตารางใบรับเครื่องซ่อมและหนังสือยินยอมส่งซ่อมต่อ (repair_tickets)
CREATE TABLE IF NOT EXISTS repair_tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_number VARCHAR(80) NOT NULL UNIQUE,
    ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    customer_snapshot JSONB NOT NULL,
    device_type VARCHAR(60) NOT NULL DEFAULT 'notebook',
    brand_model VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100),
    passcode VARCHAR(100),
    accessories TEXT,
    symptoms TEXT NOT NULL,
    physical_condition TEXT,
    is_subcontract BOOLEAN NOT NULL DEFAULT TRUE,
    subcontract_reason TEXT DEFAULT 'มีอาการเสียเกี่ยวกับระบบวงจรไฟฟ้า/เมนบอร์ดขั้นสูง จำเป็นต้องใช้เครื่องมือและช่างเฉพาะทาง',
    estimated_cost NUMERIC(14,2) DEFAULT 0,
    deposit_amount NUMERIC(14,2) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT_OUT', 'IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED')),
    technician_notes TEXT,
    appointment_date DATE,
    converted_document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repair_tickets_customer_id_idx ON repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS repair_tickets_status_idx ON repair_tickets(status);
CREATE INDEX IF NOT EXISTS repair_tickets_serial_idx ON repair_tickets(serial_number);

COMMIT;
