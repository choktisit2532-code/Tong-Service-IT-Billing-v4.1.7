# Production Checklist

## Security

- [ ] ไม่มี `.env` จริงใน ZIP/Git
- [ ] `JWT_SECRET` เป็นค่ายาวและสุ่มจริง
- [ ] `CORS_ORIGINS` จำกัดเฉพาะโดเมน Frontend จริง
- [ ] Backend ใช้ Permission Layer และตอบ 403 เมื่อไม่มีสิทธิ์

## Database

- [ ] Supabase Project พร้อมใช้งาน
- [ ] `DATABASE_URL` ถูกต้อง
- [ ] `DATABASE_SSL=true`
- [ ] `npm run db:migrate` ผ่าน
- [ ] `npm run db:check` ผ่าน
- [ ] สร้าง Admin สำเร็จ

## Backend Render

- [ ] Build `npm ci` ผ่าน
- [ ] Start `npm start` ผ่าน
- [ ] `/api/health` ตอบได้
- [ ] Login API ตอบได้

## Frontend Cloudflare Pages

- [ ] `API_BASE_URL` ชี้ไป Render Backend
- [ ] `npm run build` ผ่าน
- [ ] Login ได้
- [ ] CORS ไม่ error

## Functional Test

- [ ] Login admin/staff/viewer ได้
- [ ] สร้างลูกค้าได้
- [ ] สร้างสินค้า/บริการได้
- [ ] สร้างเอกสารได้
- [ ] เปลี่ยนสถานะเอกสารได้ตามสิทธิ์
- [ ] Print เอกสารได้
- [ ] Reports โหลดได้
- [ ] Export CSV ได้
- [ ] Audit Log ดูได้เฉพาะผู้มีสิทธิ์
- [ ] Backup export ได้เฉพาะผู้มีสิทธิ์
