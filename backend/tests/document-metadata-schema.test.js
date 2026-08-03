const test = require('node:test');
const assert = require('node:assert/strict');
const { documentMetadataSchema } = require('../src/validators/schemas');

test('metadata update accepts changing document date without line items', () => {
    const result = documentMetadataSchema.safeParse({
        document_date: '2026-07-21',
        due_date: '2026-08-05',
        remarks: 'ส่งเอกสารให้ลูกค้าวันนี้',
        payment_terms: 'เครดิต 15 วัน',
        quotation_validity_days: 15,
        show_signature: true,
        recalculate_due_date: true
    });
    assert.equal(result.success, true);
});

test('metadata update rejects due date before document date', () => {
    const result = documentMetadataSchema.safeParse({
        document_date: '2026-07-21',
        due_date: '2026-07-20',
        show_signature: false
    });
    assert.equal(result.success, false);
});
