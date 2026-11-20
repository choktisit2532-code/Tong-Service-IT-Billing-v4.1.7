-- Migration 014: Attachment documents for government procurement (จัดซื้อจัดจ้างภาครัฐ)
-- เพิ่มคอลัมน์สำหรับเก็บเอกสารแนบ 3 รายการ
BEGIN;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS attach_id_card_data        TEXT,         -- base64 PDF สำเนาบัตรประชาชน
  ADD COLUMN IF NOT EXISTS attach_id_card_expiry      DATE,         -- วันหมดอายุบัตรประชาชน
  ADD COLUMN IF NOT EXISTS attach_commercial_reg_data TEXT,         -- base64 PDF ใบทะเบียนพาณิชย์
  ADD COLUMN IF NOT EXISTS attach_sme_gp_data         TEXT,         -- base64 PDF หนังสือรับรอง SME-GP
  ADD COLUMN IF NOT EXISTS attach_sme_gp_expiry       DATE;         -- วันหมดอายุ SME-GP

COMMENT ON COLUMN settings.attach_id_card_data        IS 'สำเนาบัตรประชาชน (base64 PDF) - แนบอัตโนมัติเมื่อออกใบเสนอราคาให้ราชการ';
COMMENT ON COLUMN settings.attach_id_card_expiry      IS 'วันหมดอายุบัตรประชาชน - แจ้งเตือน 30 วันก่อนหมดอายุ';
COMMENT ON COLUMN settings.attach_commercial_reg_data IS 'ใบทะเบียนพาณิชย์ (base64 PDF)';
COMMENT ON COLUMN settings.attach_sme_gp_data         IS 'หนังสือรับรองการขึ้นทะเบียน SME-GP (base64 PDF)';
COMMENT ON COLUMN settings.attach_sme_gp_expiry       IS 'วันหมดอายุ SME-GP - แจ้งเตือน 30 วันก่อนหมดอายุ';

COMMIT;
