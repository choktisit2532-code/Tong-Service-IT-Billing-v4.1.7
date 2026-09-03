const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('product APIs disable browser caching so edits appear immediately', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'product.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /router\.get\('\/'/);
    assert.match(routeSource, /router\.get\('\/:id'/);
    assert.match(routeSource, /Cache-Control[^\n]+no-store/g);
    assert.match(routeSource, /Pragma[^\n]+no-cache/g);
});

test('product list and updates support legacy active NULL rows', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'product.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /\$3 = 'active' AND active IS DISTINCT FROM FALSE/);
    assert.match(routeSource, /before\.active === false/);
    assert.match(routeSource, /WHERE id = \$1 AND active IS DISTINCT FROM FALSE/);
});
