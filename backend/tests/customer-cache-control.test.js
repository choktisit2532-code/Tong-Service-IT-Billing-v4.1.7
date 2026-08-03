const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('customer-list API disables conditional browser caching', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'customer.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /router\.get\('\/'/);
    assert.match(routeSource, /Cache-Control[^\n]+no-store/);
    assert.match(routeSource, /Pragma[^\n]+no-cache/);
});

test('legacy customers with active NULL remain usable until explicitly deactivated', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'customer.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /statusCondition[\s\S]*active IS DISTINCT FROM FALSE/);
    assert.match(routeSource, /before\.active === false/);
    assert.match(routeSource, /WHERE id = \$1 AND active IS DISTINCT FROM FALSE/);
    assert.doesNotMatch(routeSource, /\$3 = 'active' AND active = TRUE/);
});

test('document customer options are unpaginated and include legacy active NULL rows', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'customer.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /router\.get\('\/document-options'/);
    assert.match(routeSource, /FROM customers[\s\S]*WHERE active IS DISTINCT FROM FALSE[\s\S]*ORDER BY name, id/);
});
