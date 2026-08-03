const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeProductSuggestions } = require('../src/services/product-suggestion.service');

test('combines catalog and document history without duplicate names', () => {
    const result = mergeProductSuggestions(
        [{ id: 7, name: 'ลงโปรแกรม', item_type: 'service', unit: 'เครื่อง', price: '300', active: true }],
        [
            { name: 'ลงโปรแกรม', item_type: 'service', unit: 'งาน', price: '450', last_used_at: '2026-08-03' },
            { name: 'สาย LAN', item_type: 'product', unit: 'เมตร', price: '20', last_used_at: '2026-08-02' }
        ]
    );

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
        id: 7,
        product_id: 7,
        sku: null,
        name: 'ลงโปรแกรม',
        item_type: 'service',
        unit: 'งาน',
        price: '450',
        category: null,
        active: true,
        source: 'catalog_history',
        last_used_at: '2026-08-03'
    });
    assert.equal(result[1].source, 'document_history');
    assert.equal(result[1].product_id, null);
});

test('explicitly inactive catalog names stay hidden from history suggestions', () => {
    const result = mergeProductSuggestions(
        [{ id: 8, name: 'รายการยกเลิก', item_type: 'service', unit: 'งาน', price: '100', active: false }],
        [{ name: '  รายการยกเลิก  ', item_type: 'service', unit: 'งาน', price: '100' }]
    );

    assert.deepEqual(result, []);
});

test('legacy catalog rows with null active remain available', () => {
    const result = mergeProductSuggestions(
        [{ id: 9, name: 'งานเก่า', item_type: 'service', unit: 'งาน', price: '200', active: null }],
        []
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'งานเก่า');
    assert.equal(result[0].product_id, 9);
});
