/**
 * seed-attachments.js
 * ติดตั้งเอกสารแนบ 3 รายการเข้าฐานข้อมูล:
 *   1. สำเนาบัตรประชาชน  (Scan2567-11-06_001607.pdf)  หมดอายุ: 2027-05-13
 *   2. ใบทะเบียนพาณิชย์ (ทะเบียนพาณิชย์.pdf)
 *   3. หนังสือรับรอง SME-GP (ปี_69-70.pdf)           หมดอายุ: 2027-06-30
 *
 * ใช้งาน:
 *   node backend/scripts/seed-attachments.js <path-to-pdfs-folder>
 *   หรือ (ถ้าไฟล์อยู่ที่ docs/):
 *   node backend/scripts/seed-attachments.js docs
 *
 * ต้องตั้งค่า DATABASE_URL ใน .env หรือ environment variable
 */
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

// --- กำหนดไฟล์และ metadata ---
const ATTACHMENTS = [
    {
        key:     'id-card',
        col:     'attach_id_card_data',
        expiryCol: 'attach_id_card_expiry',
        expiry:  '2027-05-13',
        filenames: ['Scan2567-11-06_001607.pdf', 'id-card.pdf']
    },
    {
        key:     'commercial-reg',
        col:     'attach_commercial_reg_data',
        expiryCol: null,
        expiry:  null,
        filenames: ['ทะเบียนพาณิชย์.pdf', 'commercial-reg.pdf']
    },
    {
        key:     'sme-gp',
        col:     'attach_sme_gp_data',
        expiryCol: 'attach_sme_gp_expiry',
        expiry:  '2027-06-30',
        filenames: ['ปี_69-70.pdf', 'sme-gp.pdf']
    }
];

async function seedAttachments(pdfFolder) {
    console.log(`\n📂 กำลังโหลดไฟล์จาก: ${path.resolve(pdfFolder)}\n`);
    const client = await pool.connect();
    try {
        for (const att of ATTACHMENTS) {
            // ค้นหาไฟล์ตาม filenames ที่กำหนด
            let found = null;
            for (const fname of att.filenames) {
                const full = path.join(pdfFolder, fname);
                if (fs.existsSync(full)) { found = full; break; }
            }
            if (!found) {
                console.warn(`⚠️  ไม่พบไฟล์ [${att.key}] (ค้นหา: ${att.filenames.join(', ')}) — ข้ามไป`);
                continue;
            }

            const buf = fs.readFileSync(found);
            if (buf.subarray(0, 4).toString('ascii') !== '%PDF') {
                console.error(`❌ ไฟล์ ${path.basename(found)} ไม่ใช่ PDF ที่ถูกต้อง — ข้ามไป`);
                continue;
            }

            const base64 = `data:application/pdf;base64,${buf.toString('base64')}`;
            const sizeKB = Math.round(buf.length / 1024);

            if (att.expiryCol && att.expiry) {
                await client.query(
                    `UPDATE settings SET ${att.col}=$1, ${att.expiryCol}=$2 WHERE id=1`,
                    [base64, att.expiry]
                );
                console.log(`✅ [${att.key}] ${path.basename(found)} (${sizeKB} KB) — หมดอายุ: ${att.expiry}`);
            } else {
                await client.query(
                    `UPDATE settings SET ${att.col}=$1 WHERE id=1`,
                    [base64]
                );
                console.log(`✅ [${att.key}] ${path.basename(found)} (${sizeKB} KB)`);
            }
        }
        console.log('\n🎉 ติดตั้งเอกสารแนบเสร็จสมบูรณ์\n');
    } finally {
        client.release();
        await pool.end();
    }
}

// รับ path จาก argument แรก หรือใช้ docs/ เป็นค่าเริ่มต้น
const folder = process.argv[2] || path.join(__dirname, '..', '..', 'docs', 'attachments');
seedAttachments(folder).catch((err) => {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
});
