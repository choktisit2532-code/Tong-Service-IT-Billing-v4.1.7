BEGIN;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents
    ADD CONSTRAINT documents_status_check
    CHECK (status IN ('DRAFT','PENDING','APPROVED','IN_PROGRESS','REJECTED','PARTIALLY_PAID','PAID','CANCELLED','OVERDUE'));

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS installment_number INTEGER,
    ADD COLUMN IF NOT EXISTS installment_count INTEGER;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_installment_number_check;
ALTER TABLE documents ADD CONSTRAINT documents_installment_number_check
    CHECK (installment_number IS NULL OR installment_number >= 1);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_installment_count_check;
ALTER TABLE documents ADD CONSTRAINT documents_installment_count_check
    CHECK (installment_count IS NULL OR installment_count >= 1);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_installment_range_check;
ALTER TABLE documents ADD CONSTRAINT documents_installment_range_check
    CHECK (
        installment_number IS NULL OR installment_count IS NULL
        OR installment_number <= installment_count
    );

CREATE INDEX IF NOT EXISTS documents_partial_payment_status_index
    ON documents (status)
    WHERE status = 'PARTIALLY_PAID';

COMMIT;
