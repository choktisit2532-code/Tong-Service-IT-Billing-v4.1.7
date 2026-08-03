function serializeDetails(details = {}) {
    try {
        return JSON.stringify(details ?? {});
    } catch (_error) {
        return JSON.stringify({ serialization_error: true });
    }
}

async function writeAudit(client, { userId, action, entityType, entityId, details = {} }) {
    if (!client || typeof client.query !== 'function') {
        throw new Error('writeAudit requires a pg Pool or Client instance');
    }

    await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
            userId || null,
            action,
            entityType,
            entityId == null ? null : String(entityId),
            serializeDetails(details)
        ]
    );
}

module.exports = { writeAudit, serializeDetails };
