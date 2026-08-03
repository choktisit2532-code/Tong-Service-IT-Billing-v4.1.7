const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('source-document API disables conditional browser caching', () => {
    const routeSource = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'routes', 'document.routes.js'),
        'utf8'
    );

    assert.match(routeSource, /router\.get\('\/sources'/);
    assert.match(routeSource, /Cache-Control[^\n]+no-store/);
    assert.match(routeSource, /Pragma[^\n]+no-cache/);
});
