BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS receipt_payment_type VARCHAR(20);

UPDATE documents
SET receipt_payment_type = CASE
    WHEN installment_number IS NOT NULL THEN 'INSTALLMENT'
    ELSE 'FULL'
END
WHERE document_type = 'RC'
  AND receipt_payment_type IS NULL;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_receipt_payment_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_receipt_payment_type_check
    CHECK (
        receipt_payment_type IS NULL
        OR receipt_payment_type IN ('DEPOSIT', 'PARTIAL', 'INSTALLMENT', 'FULL')
    );

COMMIT;
