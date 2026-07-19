# Sprint 1C Report: Service Layer Safety

## Scope

Sprint 1C focused on data consistency and operational safety in write-heavy areas.

## Changes

### 1. Reusable Transaction Helper

Added:

- `backend/src/utils/db-transaction.js`

The helper centralizes:

- `BEGIN`
- optional transaction statement timeout
- optional lock timeout
- `COMMIT`
- `ROLLBACK`
- connection release
- rollback failure logging

This reduces duplicated transaction code and prevents inconsistent rollback/release handling.

### 2. Transaction Timeouts

Updated:

- `backend/src/config/env.js`
- `backend/.env.example`

New environment variables:

```env
TRANSACTION_STATEMENT_TIMEOUT_MS=30000
TRANSACTION_LOCK_TIMEOUT_MS=5000
```

These protect the system from long-running write transactions and lock waits that can freeze user workflows.

### 3. Master Data Write Consistency

Updated:

- `backend/src/routes/user.routes.js`
- `backend/src/routes/customer.routes.js`
- `backend/src/routes/product.routes.js`

Write operations now use the shared transaction helper, including audit log writes in the same transaction.

Impact:

- User creation and password reset are no longer partially committed if audit logging fails.
- Product and customer create/update/deactivate/restore now follow the same transaction style.
- Duplicate manual try/catch/rollback blocks were removed from these routes.

### 4. Audit Serialization Safety

Updated:

- `backend/src/services/audit.service.js`

Audit details are now serialized through a safe helper. If a future payload contains a non-serializable structure, the audit layer fails predictably rather than throwing an unexpected circular JSON error.

### 5. Database Error Mapping

Updated:

- `backend/src/middleware/error-handler.js`

Added explicit handling for:

- `55P03` → `RESOURCE_LOCKED`
- `57014` → `DATABASE_STATEMENT_TIMEOUT`
- `40P01` → `DATABASE_DEADLOCK`
- `40001` → `DATABASE_SERIALIZATION_FAILURE`

This gives users clearer messages and gives operators more useful error codes.

## Risk Reduction

| Area | Before | After |
|---|---|---|
| Transaction handling | Repeated manual code | Central helper |
| User create/reset audit | Possible partial commit | Atomic transaction |
| Lock wait behavior | Could wait too long | Configurable lock timeout |
| Long write queries | Could block longer | Configurable statement timeout |
| DB error response | Generic errors | Mapped operational codes |

## Files Changed

- `backend/src/utils/db-transaction.js`
- `backend/src/config/env.js`
- `backend/.env.example`
- `backend/src/routes/user.routes.js`
- `backend/src/routes/customer.routes.js`
- `backend/src/routes/product.routes.js`
- `backend/src/services/audit.service.js`
- `backend/src/middleware/error-handler.js`

## Verification

Run after extracting the ZIP:

```bash
cd backend
npm ci
npm test
npm start
```

Suggested manual checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

Then test:

- Create user
- Reset user password
- Create customer
- Update customer
- Deactivate/restore customer
- Create product
- Update product
- Deactivate/restore product


## Local Verification Result in ChatGPT Runtime

Syntax checks passed for changed files:

- `backend/src/utils/db-transaction.js`
- `backend/src/config/env.js`
- `backend/src/routes/user.routes.js`
- `backend/src/routes/customer.routes.js`
- `backend/src/routes/product.routes.js`
- `backend/src/services/audit.service.js`
- `backend/src/middleware/error-handler.js`

`node --test` was attempted, but the runtime does not have installed dependencies. The failing tests reported missing modules only:

- `zod`
- `decimal.js`

After running `npm ci`, rerun `npm test` normally.
