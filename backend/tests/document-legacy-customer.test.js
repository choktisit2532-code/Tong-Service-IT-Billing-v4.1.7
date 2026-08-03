const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('document creation and full edits allow legacy customers with active NULL', () => {
    const serviceSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'services', 'document.service.js'),
        'utf8'
    );

    assert.match(
        serviceSource,
        /SELECT \* FROM customers WHERE id = \$1 AND active IS DISTINCT FROM FALSE FOR SHARE/
    );
    assert.match(
        serviceSource,
        /const customerActiveCondition = isSafeOnly \? '' : 'AND active IS DISTINCT FROM FALSE';/
    );
    assert.doesNotMatch(serviceSource, /customers WHERE id = \$1 AND active = TRUE FOR SHARE/);
    assert.doesNotMatch(serviceSource, /customerActiveCondition = isSafeOnly \? '' : 'AND active = TRUE'/);
});
