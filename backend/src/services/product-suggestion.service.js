function normaliseName(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function mergeProductSuggestions(catalogRows = [], historyRows = []) {
    const catalogByName = new Map();
    const hiddenNames = new Set();

    for (const row of catalogRows) {
        const key = normaliseName(row.name);
        if (!key) continue;
        if (row.active === false) {
            hiddenNames.add(key);
            continue;
        }
        if (!catalogByName.has(key)) catalogByName.set(key, row);
    }

    const suggestions = new Map();
    for (const row of historyRows) {
        const key = normaliseName(row.name);
        if (!key || hiddenNames.has(key) || suggestions.has(key)) continue;
        const catalog = catalogByName.get(key);
        suggestions.set(key, {
            id: catalog?.id || null,
            product_id: catalog?.id || null,
            sku: catalog?.sku || null,
            name: String(row.name || catalog?.name || '').trim(),
            item_type: row.item_type || catalog?.item_type || 'service',
            unit: String(row.unit || catalog?.unit || 'งาน').trim() || 'งาน',
            price: row.price ?? catalog?.price ?? 0,
            category: catalog?.category || null,
            active: true,
            source: catalog ? 'catalog_history' : 'document_history',
            last_used_at: row.last_used_at || null
        });
    }

    for (const [key, row] of catalogByName) {
        if (hiddenNames.has(key) || suggestions.has(key)) continue;
        suggestions.set(key, {
            ...row,
            product_id: row.id || null,
            active: true,
            source: 'catalog',
            last_used_at: null
        });
    }

    return [...suggestions.values()];
}

async function listProductSuggestions(db, limit = 500) {
    const [catalogResult, historyResult] = await Promise.all([
        db.query(
            `SELECT id, sku, name, item_type, unit, price, category, active
             FROM products
             ORDER BY updated_at DESC NULLS LAST, id DESC`
        ),
        db.query(
            `SELECT name, item_type, unit, price, last_used_at
             FROM (
                 SELECT DISTINCT ON (LOWER(BTRIM(di.description)))
                        di.description AS name,
                        di.item_type,
                        di.unit,
                        di.unit_price AS price,
                        COALESCE(di.created_at, d.updated_at, d.created_at) AS last_used_at,
                        di.id
                 FROM document_items di
                 JOIN documents d ON d.id = di.document_id
                 WHERE d.deleted_at IS NULL
                   AND di.line_type = 'item'
                   AND BTRIM(COALESCE(di.description, '')) <> ''
                 ORDER BY LOWER(BTRIM(di.description)),
                          COALESCE(di.created_at, d.updated_at, d.created_at) DESC NULLS LAST,
                          di.id DESC
             ) latest
             ORDER BY last_used_at DESC NULLS LAST, name
             LIMIT $1`,
            [limit]
        )
    ]);

    return mergeProductSuggestions(catalogResult.rows, historyResult.rows).slice(0, limit);
}

module.exports = { normaliseName, mergeProductSuggestions, listProductSuggestions };
