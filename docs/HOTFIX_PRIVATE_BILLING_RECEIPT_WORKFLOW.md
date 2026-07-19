# Hotfix: Private Billing / Receipt Workflow

## Issue

In the private-customer workflow, an invoice (`IN`) that had already been receipted became `PAID` and was then hidden from the billing-note (`BN`) source picker. The backend also rejected paid source documents for every target document type. This made the following legitimate workflows impossible or incomplete:

1. Create invoice -> create receipt -> create billing note later.
2. Create invoice -> create billing note -> create receipt from invoice.
3. Keep the billing note linked to the active receipt when the receipt was created before or after the billing note.

## Root Cause

`listAvailableSources()` used a global source filter:

```sql
AND d.status NOT IN ('CANCELLED', 'PAID', 'REJECTED')
```

`createDocument()` also rejected `PAID` sources for every target type. That rule is correct for creating receipts, but too strict for creating billing notes from already-paid invoices.

## Fix

Updated `backend/src/services/document.service.js`:

- Billing notes (`BN`) can now use invoices (`IN`) with status `PAID` as source documents, while still rejecting cancelled or rejected invoices.
- Receipt creation remains strict and still rejects already-paid source documents to prevent duplicate receipts.
- When a billing note is created from an invoice that already has an active receipt, the system automatically links the billing note to that receipt using `PAID_BY`.
- When a receipt is created from an invoice that already belongs to a billing note, the system automatically links that billing note to the new receipt using `PAID_BY`.
- Billing-note status is refreshed after the automatic receipt linkage.

## Expected Behavior After Fix

### Flow A: Billing first, receipt later

`IN -> BN -> RC`

- Create `BN` from `IN`.
- Create `RC` from `BN` or from the `IN`.
- `IN` becomes `PAID`.
- Related `BN` becomes `PAID`.
- The active receipt is linked to the billing note.

### Flow B: Receipt first, billing later

`IN -> RC -> BN`

- Create `RC` from `IN`.
- `IN` becomes `PAID`.
- The paid `IN` remains selectable when creating `BN`.
- Create `BN` from that paid `IN`.
- The new `BN` is automatically linked to the existing `RC`.
- The new `BN` becomes `PAID`.

## Recommended Manual Test

1. Create/select a private customer.
2. Create an invoice (`IN`).
3. Create a receipt (`RC`) from that invoice.
4. Create a billing note (`BN`) and open the source selector.
5. Confirm the paid invoice appears as an available billing source.
6. Create the billing note.
7. Confirm the billing note is `PAID` and is linked to the receipt.

Also test the reverse flow:

1. Create invoice (`IN`).
2. Create billing note (`BN`) from invoice.
3. Create receipt (`RC`) from invoice or billing note.
4. Confirm both invoice and billing note become `PAID`.
