require('dotenv').config();

const pool = require('../src/config/db');
const { getSchemaStatus, getDocumentSchemaStatus } = require('../src/services/schema.service');

async function check() {
    const result = await pool.query(`
        SELECT filename, applied_at
        FROM schema_migrations
        ORDER BY applied_at
    `).catch(() => ({ rows: [] }));
    const status = await getSchemaStatus(pool);
    const documentStatus = await getDocumentSchemaStatus(pool);

    console.log('Applied migrations:');
    if (!result.rows.length) console.log('- none');
    result.rows.forEach((row) => console.log(`- ${row.filename}`));

    console.log(`Database schema: ${status.ready ? 'READY' : 'NOT READY'}`);
    if (status.missing_tables.length) console.log(`Missing tables: ${status.missing_tables.join(', ')}`);
    for (const [table, columns] of Object.entries(status.missing_columns)) {
        if (columns.length) console.log(`Missing columns in ${table}: ${columns.join(', ')}`);
    }

    console.log(`Document schema: ${documentStatus.ready ? 'READY' : 'NOT READY'}`);
    if (!status.ready) process.exitCode = 1;
}

check()
    .catch((error) => {
        console.error('Schema check failed:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
