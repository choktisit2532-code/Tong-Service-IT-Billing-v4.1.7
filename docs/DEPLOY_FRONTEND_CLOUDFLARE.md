# Deploy Frontend บน Cloudflare Pages

## 1. ค่า Build

- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Output Directory: `dist`

## 2. Environment Variables

ตั้งค่าใน Cloudflare Pages > Settings > Environment variables

```env
API_BASE_URL=https://your-render-backend.onrender.com/api
```

## 3. ตรวจหลัง Deploy

- เปิดหน้า Login ได้
- Login ด้วย admin ได้
- Frontend เรียก Backend แล้วไม่ติด CORS
- สร้างลูกค้า/สินค้า/เอกสารได้
- Reports โหลดได้
- Audit Log เปิดได้ตามสิทธิ์

## 4. ปัญหาที่พบบ่อย

- ถ้า Login ไม่ได้: ตรวจ `API_BASE_URL`
- ถ้า CORS error: กลับไปตั้ง `CORS_ORIGINS` ใน Render
- ถ้า build ไม่ผ่าน: รัน `npm run build` ในเครื่องก่อน
