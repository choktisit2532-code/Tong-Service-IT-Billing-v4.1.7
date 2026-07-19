require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const tables = ['customers','products','settings','documents','document_items','document_relations','document_signatures','audit_logs'];

async function main() {
    const source = process.argv[2];
    if (!source) throw new Error('Usage: node scripts/restore-database.js <backup.json>');
    const backup = JSON.parse(fs.readFileSync(path.resolve(source), 'utf8'));
    if (!backup.data) throw new Error('Invalid backup file');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SET CONSTRAINTS ALL DEFERRED');
        for (const table of [...tables].reverse()) {
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }
        for (const table of tables) {
            for (const row of backup.data[table] || []) {
                const columns = Object.keys(row);
                if (!columns.length) continue;
                const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
                const quoted = columns.map((column) => `"${column.replace(/"/g, '""')}"`).join(',');
                await client.query(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`, columns.map((column) => row[column]));
            }
        }
        await client.query('COMMIT');
        console.log('Restore completed');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => pool.end());
