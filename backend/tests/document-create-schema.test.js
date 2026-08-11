const test = require('node:test');
const assert = require('node:assert/strict');
const { documentCreateSchema } = require('../src/validators/schemas');

const base = {
    document_date: '2026-07-01',
    due_date: null,
    customer_id: 1,
    discount: 0,
    remarks: '',
    payment_terms: '',
    delivery_days: null,
    quotation_validity_days: null,
    items: [{
        line_type: 'item',
        item_type: 'service',
        product_id: null,
        description: 'ค่าบริการ',
        quantity: 1,
        unit: 'งาน',
        unit_price: 100,
        text_style: 'normal'
    }]
};

test('QT does not accept a source document', () => {
    const result = documentCreateSchema.safeParse({ ...base, document_type: 'QT', source_document_ids: [1] });
    assert.equal(result.success, false);
});

test('BN requires one or more invoice sources', () => {
    const result = documentCreateSchema.safeParse({ ...base, document_type: 'BN', source_document_ids: [], items: [] });
    assert.equal(result.success, false);
});

test('BN accepts multiple source documents', () => {
    const result = documentCreateSchema.safeParse({ ...base, document_type: 'BN', source_document_ids: [1, 2], items: [] });
    assert.equal(result.success, true);
});

test('RC accepts at most one source document in guided workflow', () => {
    const result = documentCreateSchema.safeParse({ ...base, document_type: 'RC', source_document_ids: [1, 2], items: [] });
    assert.equal(result.success, false);
});

test('RC with an invoice source requires the amount paid this time', () => {
    const result = documentCreateSchema.safeParse({ ...base, document_type: 'RC', source_document_ids: [1], items: [] });
    assert.equal(result.success, false);
    assert.equal(result.error.issues.some((issue) => issue.path[0] === 'receipt_payment_amount'), true);
});

test('RC accepts a partial installment payment', () => {
    const result = documentCreateSchema.safeParse({
        ...base,
        document_type: 'RC',
        source_document_ids: [1],
        items: [],
        receipt_payment_amount: 50000,
        receipt_payment_type: 'INSTALLMENT',
        installment_number: 1,
        installment_count: 2
    });
    assert.equal(result.success, true);
});

test('RC installment requires installment details', () => {
    const result = documentCreateSchema.safeParse({
        ...base,
        document_type: 'RC',
        source_document_ids: [1],
        items: [],
        receipt_payment_amount: 500,
        receipt_payment_type: 'INSTALLMENT'
    });
    assert.equal(result.success, false);
    assert.equal(result.error.issues.some((issue) => issue.path[0] === 'installment_number'), true);
});

test('RC accepts a deposit payment', () => {
    const result = documentCreateSchema.safeParse({
        ...base,
        document_type: 'RC',
        source_document_ids: [1],
        items: [],
        receipt_payment_amount: 500,
        receipt_payment_type: 'DEPOSIT',
        receipt_payment_method: 'CASH'
    });
    assert.equal(result.success, true);
    assert.equal(result.data.receipt_payment_method, 'CASH');
});


test('signature is optional and defaults to hidden', () => {
    const result = documentCreateSchema.safeParse({
        ...base,
        document_type: 'QT',
        source_document_ids: []
    });
    assert.equal(result.success, true);
    assert.equal(result.data.show_signature, false);
});

test('document can explicitly include the saved signature', () => {
    const result = documentCreateSchema.safeParse({
        ...base,
        document_type: 'QT',
        source_document_ids: [],
        show_signature: true
    });
    assert.equal(result.success, true);
    assert.equal(result.data.show_signature, true);
});
