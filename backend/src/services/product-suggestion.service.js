function normaliseName(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function mergeProductSuggestions(catalogRows = [], historyRows = []) {
    const catalogByName = new Map();
    const catalogById = new Map();
    const hiddenNames = new Set();

    for (const row of catalogRows) {
        const key = normaliseName(row.name);
        if (!key) continue;
        if (row.id != null) catalogById.set(String(row.id), row);
        if (row.active === false) {
            hiddenNames.add(key);
            continue;
        }
        if (!catalogByName.has(key)) catalogByName.set(key, row);
    }

    const suggestions = new Map();
    for (const row of historyRows) {
        const linkedCatalog = row.product_id != null ? catalogById.get(String(row.product_id)) : null;
        if (linkedCatalog?.active === false) continue;
        const historyKey = normaliseName(row.name);
        const catalog = linkedCatalog || catalogByName.get(historyKey);
        const currentName = String(catalog?.name || row.name || '').trim();
        const key = normaliseName(currentName);
        if (!key || hiddenNames.has(key) || suggestions.has(key)) continue;
        suggestions.set(key, {
            id: catalog?.id || null,
            product_id: catalog?.id || null,
            sku: catalog?.sku || null,
            name: currentName,
            item_type: catalog?.item_type || row.item_type || 'service',
            unit: String(catalog?.unit || row.unit || 'งาน').trim() || 'งาน',
            price: catalog?.price ?? row.price ?? 0,
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
            `SELECT name, item_type, product_id, unit, price, last_used_at
             FROM (
                 SELECT DISTINCT ON (LOWER(BTRIM(di.description)))
                        di.description AS name,
                        di.item_type,
                        di.product_id,
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
