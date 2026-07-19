# Tong Service IT Billing v4.1.7 Deploy Ready

ระบบ Billing สำหรับธุรกิจบริการ IT แยก Backend / Frontend / Database พร้อม UX หน้ากรอกเอกสาร, Reports, Permission Layer, Audit Log และคู่มือ Deploy สำหรับ Render + Cloudflare Pages + Supabase

## Tech Stack

- Backend: Node.js >=20 <23, Express, CommonJS, PostgreSQL
- Frontend: Static HTML/CSS/Vanilla JS, Chart.js, Lucide Icons
- Database: Supabase PostgreSQL / PostgreSQL compatible
- Deploy target:
  - Backend: Render
  - Frontend: Cloudflare Pages
  - Database: Supabase PostgreSQL

## คำสั่ง Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run db:migrate
npm run create-admin
npm run db:check
npm test
npm start
```

## คำสั่ง Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run build
npm run dev
```

## สิ่งที่เพิ่มใน v4.1.7

- Advanced Reports: รายได้, ลูกหนี้, Aging, ภาษีหัก ณ ที่จ่าย, ค่าธรรมเนียมโอน, Top Customers, Sales by Type, เอกสารยกเลิก
- Export CSV สำหรับ Reports และ Audit Log
- Permission Layer แบบ permission key พร้อม fallback จาก role เดิม
- Audit Log UI รวมทั้งระบบ
- Deploy Docs สำหรับ Render + Cloudflare Pages + Supabase
- Production Checklist และ Troubleshooting


## สิ่งที่แก้ไขในรอบ Security/Foundation

- ปรับเวอร์ชัน Backend/Frontend เป็น `4.1.7` ให้ตรงกับ Release ZIP
- ปรับ Backend startup ให้เริ่มระบบได้แม้ Database ยังไม่พร้อม และแสดงสถานะ degraded ผ่าน readiness endpoint
- เพิ่ม `/api/health/ready` สำหรับตรวจ Database, Schema และ Migration ล่าสุด
- เพิ่ม Login Rate Limit เฉพาะ `/api/auth/login` เพื่อลดความเสี่ยง brute-force
- เพิ่ม Audit Log สำหรับการ Login สำเร็จและล้มเหลว โดยไม่บันทึกรหัสผ่าน
- ปรับ Node Engine เป็น `>=20 <23` เพื่อ Deploy ได้ยืดหยุ่นขึ้น

## เอกสาร Deploy

ดูในโฟลเดอร์ `docs/`

- `DEPLOY_BACKEND_RENDER.md`
- `DEPLOY_FRONTEND_CLOUDFLARE.md`
- `DEPLOY_DATABASE_SUPABASE.md`
- `PRODUCTION_CHECKLIST.md`
- `MANUAL_TEST_CHECKLIST.md`
- `TROUBLESHOOTING.md`

## ข้อควรระวัง

- ห้ามนำ `.env` จริงขึ้น Git หรือใส่ใน Release ZIP
- Backend ใช้ CommonJS ห้ามผสม `import/export` โดยไม่แปลงทั้งระบบ
- Frontend ซ่อนปุ่มตามสิทธิ์เพื่อ UX แต่ Backend เป็นตัวตรวจสิทธิ์จริงเสมอ

## Hotfix: Customer Code Auto Number

- ปรับรหัสลูกค้าให้ระบบสร้างอัตโนมัติ เริ่มจาก `0001` และเพิ่มทีละ 1
- ผู้ใช้ไม่ต้องกรอกรหัสลูกค้าเอง ช่องรหัสลูกค้าในฟอร์มเป็น read-only
- Backend ใช้ transaction lock เพื่อป้องกันเลขซ้ำเมื่อเพิ่มลูกค้าพร้อมกัน
- เพิ่ม migration `008_customer_code_autonumber.sql` สำหรับเติมรหัสลูกค้าเดิมที่ยังไม่มีรหัส


## Production readiness

See `docs/PRODUCTION_READINESS_CHECKLIST.md` for final deployment and QA steps.
