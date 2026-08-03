# Deploy Backend บน Render

เป้าหมาย: รัน Backend ของ Tong Service IT Billing บน Render Web Service

## 1. ค่า Service

- Service Type: Web Service
- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm ci`
- Start Command: `npm start`

## 2. Environment Variables

ตั้งค่าใน Render > Environment

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=change-to-long-random-secret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=https://your-cloudflare-pages-domain.pages.dev
```

## 3. ตรวจหลัง Deploy

เปิด URL Backend แล้วตรวจ:

- `/` ต้องเห็นชื่อ API และ version
- `/api/health` ต้องตอบสถานะระบบ
- Login จาก Frontend ต้องไม่ติด CORS

## 4. คำสั่งหลังเชื่อม Database

รันในเครื่องหรือ Render Shell ที่มี env ตรง Production:

```bash
cd backend
npm run db:migrate
npm run create-admin
npm run db:check
```

## 5. ปัญหาที่พบบ่อย

- CORS error: ตรวจ `CORS_ORIGINS` ให้ตรงกับโดเมน Cloudflare Pages
- Database connection error: ตรวจ `DATABASE_URL` และ SSL
- 401 หลัง Login: ตรวจ `JWT_SECRET` และเวลาเครื่อง/เซิร์ฟเวอร์
