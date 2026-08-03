# Troubleshooting

## Frontend เรียก Backend ไม่ได้

ตรวจ `API_BASE_URL` ใน Cloudflare Pages ว่าลงท้ายด้วย `/api` หรือไม่

## CORS error

ตั้ง `CORS_ORIGINS` ใน Render ให้ตรงกับโดเมน Cloudflare Pages เช่น:

```env
CORS_ORIGINS=https://tong-billing.pages.dev
```

## Database SSL error

ใช้ค่า:

```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

## Permission 403

ตรวจ role ของผู้ใช้:

- admin: ทำได้ทั้งหมด
- staff: งานเอกสาร/ลูกค้า/สินค้า/รายงาน
- viewer: ดูและพิมพ์เท่านั้น

## Reports ไม่มีข้อมูล

ตรวจช่วงวันที่ และตรวจว่ามีเอกสารที่ไม่ถูกยกเลิกในช่วงนั้น
