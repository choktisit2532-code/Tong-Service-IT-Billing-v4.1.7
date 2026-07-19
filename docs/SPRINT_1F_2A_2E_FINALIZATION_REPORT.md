# Finalization Sprint Report

This package combines the requested next work items:

## Sprint 1F: Report & Dashboard Query Optimization
- Added lightweight in-memory cache for Dashboard and Advanced Report endpoints.
- Added `X-Cache` response header.
- Added report list limit guard to reduce heavy report payloads.

## Sprint 2A: Frontend UX Hardening
- Added double-click protection through enhanced `setBusy()`.
- Added busy state for report and audit loading buttons.
- Kept previous unsaved new-document confirmation.

## Sprint 2B: Print / PDF Document Review
- Added print watermark for Draft, Cancelled, Paid, and Rejected states.
- Added print page-break protection for rows, terms, payment boxes, and signature boxes.
- Kept BN naming as “ใบแจ้งยอดชำระ”.

## Sprint 2C: Permission / Role Audit
- Added backend permission audit tests for viewer, staff, and admin roles.
- Existing backend authorization remains enforced by `authorize()` middleware.

## Sprint 2D: Backup & Restore
- Added backend backup and restore scripts:
  - `npm run backup`
  - `npm run restore <backup.json>`
- Added admin-only `/api/backup/restore` endpoint accepting a JSON backup file.

## Sprint 2E: Production Deployment Finalization
- Added PM2 `ecosystem.config.cjs`.
- Added Nginx example config.
- Added systemd example.
- Added production readiness checklist.

## Notes
- Restore is destructive by design. Use only on a prepared target database.
- Cache TTL is intentionally short (60 seconds) to keep billing data fresh.
