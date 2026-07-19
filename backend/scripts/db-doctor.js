require('dotenv').config();

const pool = require('../src/config/db');
const { getSchemaStatus } = require('../src/services/schema.service');

async function main() {
    const status = await getSchemaStatus(pool);
    console.log(JSON.stringify(status, null, 2));

    if (!status.ready) {
        console.log('\nคำแนะนำ: รันคำสั่งต่อไปนี้เพื่อเติม schema ที่ขาด');
        console.log('npm run migrate');
        console.log('\nถ้ายังไม่ผ่าน ให้ตรวจสิทธิ์ DATABASE_URL ว่าสามารถ CREATE/ALTER TABLE ได้');
        process.exitCode = 1;
    } else {
        console.log('\nฐานข้อมูลพร้อมใช้งานกับระบบเวอร์ชันนี้');
    }
}

main()
    .catch((error) => {
        console.error('DB doctor failed:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
