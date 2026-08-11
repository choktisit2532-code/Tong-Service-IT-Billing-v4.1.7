require('dotenv').config();
const pool = require('../src/config/db');

const tables = [
    'customers', 'products', 'documents', 'document_items',
    'document_relations', 'document_signatures', 'audit_logs'
];

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const table of tables) {
            const sequenceResult = await client.query(
                'SELECT pg_get_serial_sequence($1, $2) AS sequence_name',
                [table, 'id']
            );
            const sequenceName = sequenceResult.rows[0]?.sequence_name;
            if (!sequenceName) continue;
            await client.query(
                `SELECT setval(
                    $1::regclass,
                    COALESCE((SELECT MAX(id) FROM ${table}), 1),
                    EXISTS (SELECT 1 FROM ${table})
                )`,
                [sequenceName]
            );
        }
        await client.query('COMMIT');
        console.log('Database sequences repaired');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => pool.end());
