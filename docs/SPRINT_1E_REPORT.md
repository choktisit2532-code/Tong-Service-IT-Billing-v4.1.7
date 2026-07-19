# Sprint 1E Report: Database Performance & Index Hardening

## Scope

Sprint 1E focuses on database performance for the highest-traffic screens and workflows:

- Document list search and filtering
- Dashboard statistics and charts
- Available source document picker
- Duplicate billing / duplicate receipt checks
- Report queries
- Audit log list and export filters

## Files Changed

- `database/migrations/007_performance_indexes.sql`
- `backend/src/services/document.service.js`
- `docs/SPRINT_1E_REPORT.md`

## Database Changes

Added migration `007_performance_indexes.sql` with indexes for:

- Trigram search on `documents.document_number`
- Trigram search on `customers.name`
- Active document list filters by type, status, customer, and date
- Receipt date range queries
- Receivable invoice aging queries
- Document relation `NOT EXISTS` workflow checks
- Service line aggregation in dashboard/report pages
- Audit log filtering by user, action, entity type, and created date

The migration uses `CREATE INDEX IF NOT EXISTS` to keep repeated deployment safe.

## Backend Query Improvements

### `listDocuments()`

Changed data query and total-count query to run in parallel with `Promise.all()`.

Benefit:

- Reduces API latency on document list pages.
- Keeps the response shape unchanged.

### `listAvailableSources()`

Added receipt-source exclusion for `target_type = 'RC'`.

Benefit:

- The source picker no longer shows documents that already have an active receipt.
- This complements the server-side protection added in Sprint 1D.

## Recommended Verification

After deploying Sprint 1E, run:

```bash
cd backend
npm ci
npm run migrate
npm test
npm start
```

Then verify:

```bash
curl http://localhost:3000/api/health/ready
```

Useful SQL checks:

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%trgm%'
ORDER BY indexname;

SELECT filename, applied_at
FROM schema_migrations
ORDER BY applied_at DESC;
```

For large databases, confirm critical queries with:

```sql
EXPLAIN ANALYZE
SELECT d.id, d.document_number, d.document_type, d.status, d.document_date
FROM documents d
JOIN customers c ON c.id = d.customer_id
WHERE d.deleted_at IS NULL
ORDER BY d.document_date DESC, d.id DESC
LIMIT 50;
```

## Notes

The new migration enables `pg_trgm`. PostgreSQL normally treats `pg_trgm` as a trusted extension, but some hosted databases may restrict extension creation. If your database user cannot create extensions, ask the database admin/provider to enable `pg_trgm` once, then rerun migration.
