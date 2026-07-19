const store = new Map();

function getCache(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
    }
    return item.value;
}

function setCache(key, value, ttlMs = 60000) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
}

function clearCache(prefix = '') {
    for (const key of store.keys()) {
        if (!prefix || key.startsWith(prefix)) store.delete(key);
    }
}

function cacheStats() {
    return { keys: store.size };
}

module.exports = { getCache, setCache, clearCache, cacheStats };
