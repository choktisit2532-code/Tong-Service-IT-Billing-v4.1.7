# Hotfix: Session Expiry Handling

## Problem
ระบบใช้ JWT อายุ 8 ชั่วโมง (`JWT_EXPIRES_IN=8h`) เมื่อใช้งานไปสักพัก token หมดอายุ backend จะตอบ 401 และ frontend ลบ token ทันที ทำให้ผู้ใช้ดูเหมือน “หลุดสิทธิ์” และทำอะไรต่อไม่ได้จนกว่าจะล็อกอินใหม่

## Changes
- เปลี่ยน default JWT expiry จาก `8h` เป็น `7d`
- อัปเดต `backend/.env.example` เป็น `JWT_EXPIRES_IN=7d`
- ปรับ frontend ให้จัดการ 401 ชัดเจนขึ้น:
  - ลบ token
  - แจ้งเตือนว่า session หมดอายุ
  - redirect ไปหน้า login อัตโนมัติ
  - ป้องกันการแจ้งเตือนซ้ำหลายครั้งเมื่อหลาย request เจอ 401 พร้อมกัน

## Files changed
- backend/src/config/env.js
- backend/.env.example
- frontend/src/js/api.js
- frontend/src/js/app.js

## Important
ถ้า server production มีไฟล์ `.env` อยู่แล้ว ต้องแก้ค่าใน `.env` จริงด้วย:

```env
JWT_EXPIRES_IN=7d
```

จากนั้น restart backend

## QA checklist
1. Login แล้วใช้งานระบบตามปกติ
2. ตรวจว่า session ไม่หลุดเร็วเหมือนเดิม
3. หาก token หมดอายุจริง ต้องเห็นข้อความแจ้งเตือนและกลับไปหน้า login อย่างเป็นระเบียบ
