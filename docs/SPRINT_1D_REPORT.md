# Sprint 1D Report: Document Service Hardening

## Scope

Sprint 1D focused on `backend/src/services/document.service.js`, especially document creation, source document relations, receipt/billing workflow consistency, and calculation error handling.

## Changes

### 1. Reused the central transaction helper for document creation

`createDocument()` now uses `withTransaction()` from `backend/src/utils/db-transaction.js`.

Benefits:

- Consistent `BEGIN` / `COMMIT` / `ROLLBACK` handling
- Centralized rollback failure logging
- Applies transaction statement timeout and lock timeout from environment settings

### 2. Prevented duplicate source documents

Added `normalizeSourceDocumentIds()` to reject duplicated `source_document_ids` before locking and creating relations.

New error code:

- `DUPLICATE_SOURCE_DOCUMENT`

This avoids false source-document-not-found behavior and prevents duplicate relation attempts from the UI or API clients.

### 3. Added receipt-source conflict guard

Added `assertReceiptSourcesAvailable()` so an active receipt cannot be issued again for the same source document.

New error code:

- `SOURCE_ALREADY_RECEIPTED`

This reduces race-condition risk around receipt issuance when users or API clients submit repeated requests.

### 4. Hardened calculation error mapping

Added service-level calculation error mapping for:

- Discount greater than subtotal
- Withholding greater than total
- Withholding plus transfer fee greater than total

Error codes:

- `INVALID_DISCOUNT`
- `INVALID_WITHHOLDING_AMOUNT`
- `INVALID_PAYMENT_DEDUCTIONS`

The global error handler was also updated with these mappings as a fallback.

### 5. Added schema readiness checks to document mutations

The following document mutation flows now run schema readiness checks before mutating data:

- `updateDocumentStatus()`
- `cancelDocument()`
- `softDeleteDocument()`
- `restoreDocument()`

This prevents partial failures when the database has not been migrated to the expected schema.

## Files changed

- `backend/src/services/document.service.js`
- `backend/src/middleware/error-handler.js`
- `docs/SPRINT_1D_REPORT.md`

## Validation performed

Syntax checks passed for all backend source files:

```bash
find backend/src -name '*.js' -print0 | xargs -0 -n1 node --check
```

Full test execution still requires installing dependencies first:

```bash
cd backend
npm ci
npm test
```

## Recommended next sprint

Sprint 1E should focus on database performance and consistency:

- Add missing indexes for document list/search workflows
- Review query plans for `listDocuments()`, `listAvailableSources()`, and report queries
- Add migration safety checks for relation tables
- Improve pagination performance for large datasets
