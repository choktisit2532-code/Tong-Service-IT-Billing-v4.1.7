BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS receipt_payment_method VARCHAR(20);

UPDATE documents
SET receipt_payment_method = 'TRANSFER'
WHERE document_type = 'RC'
  AND receipt_payment_method IS NULL;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_receipt_payment_method_check;
ALTER TABLE documents ADD CONSTRAINT documents_receipt_payment_method_check
    CHECK (
        receipt_payment_method IS NULL
        OR receipt_payment_method IN ('CASH', 'TRANSFER', 'CHECK', 'OTHER')
    );

COMMIT;
