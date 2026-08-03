require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const tables = ['customers','products','settings','documents','document_items','document_relations','document_signatures','audit_logs'];

async function main() {
    const outputDir = path.resolve(__dirname, '../../backups');
    fs.mkdirSync(outputDir, { recursive: true });
    const backup = { version: 3, exported_at: new Date().toISOString(), tables, data: {} };
    for (const table of tables) {
        const result = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
        backup.data[table] = result.rows;
    }
    const file = path.join(outputDir, `tong-billing-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Backup written: ${file}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => pool.end());
