BEGIN;

-- Sprint 1E: Database Performance & Index Hardening
-- These indexes support the document list, dashboard, reports, audit log filters,
-- source-document pickers, and workflow duplicate checks as data volume grows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast contains search for document number and customer name in list screens.
CREATE INDEX IF NOT EXISTS documents_number_trgm_index
    ON documents USING GIN (document_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_name_trgm_index
    ON customers USING GIN (name gin_trgm_ops);

-- Common document list filters and dashboard / report date ranges.
CREATE INDEX IF NOT EXISTS documents_active_type_status_date_id_index
    ON documents (document_type, status, document_date DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_active_customer_date_id_index
    ON documents (customer_id, document_date DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_active_status_due_id_index
    ON documents (status, due_date, id)
    WHERE deleted_at IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_receipts_date_id_index
    ON documents (document_date DESC, id DESC)
    WHERE deleted_at IS NULL AND document_type = 'RC' AND status <> 'CANCELLED';

CREATE INDEX IF NOT EXISTS documents_invoices_receivable_index
    ON documents (due_date, document_date, id)
    WHERE deleted_at IS NULL
      AND document_type = 'IN'
      AND status IN ('PENDING', 'APPROVED', 'OVERDUE');

-- Speed up NOT EXISTS checks for converted, billed, and receipted source documents.
CREATE INDEX IF NOT EXISTS document_relations_source_relation_target_index
    ON document_relations (source_document_id, relation_type, target_document_id);

CREATE INDEX IF NOT EXISTS document_relations_target_relation_source_index
    ON document_relations (target_document_id, relation_type, source_document_id);

-- Dashboard / report queries that aggregate service lines from receipt documents.
CREATE INDEX IF NOT EXISTS document_items_service_line_document_index
    ON document_items (document_id, description)
    WHERE line_type = 'item' AND item_type = 'service';

CREATE INDEX IF NOT EXISTS document_items_item_type_document_index
    ON document_items (item_type, document_id)
    WHERE line_type = 'item';

-- Audit page filters and export queries.
CREATE INDEX IF NOT EXISTS audit_logs_user_created_at_index
    ON audit_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_index
    ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_type_created_at_index
    ON audit_logs (entity_type, created_at DESC);

COMMIT;
