# Hotfix: Database Compatibility Backfill

## ทำไมต้องมีไฟล์นี้
บางฐานข้อมูลอาจถูกสร้างจากเวอร์ชันเก่า หรือ migrate ไม่ครบ ทำให้ตาราง/คอลัมน์ที่โค้ดเวอร์ชันล่าสุดต้องใช้ยังขาดอยู่

## สิ่งที่เพิ่ม
เพิ่ม migration:

```text
database/migrations/009_schema_compat_backfill.sql
```

Migration นี้ออกแบบให้รันซ้ำได้และไม่ลบข้อมูลเดิม โดยจะเติม:
- ตารางหลักที่ขาด
- คอลัมน์หลักที่ขาด
- index หลัก
- trigger `updated_at`
- status constraint ล่าสุด
- customer code auto-number backfill
- settings row เริ่มต้น

## คำสั่งตรวจฐานข้อมูล
```bash
cd backend
npm run db:doctor
```

ถ้าพบว่าขาด schema ให้รัน:
```bash
npm run migrate
npm run db:doctor
```

## ข้อควรระวัง
- ถ้าฐานข้อมูลเดิมมีข้อมูลที่ผิดความสัมพันธ์มาก ๆ migration จะไม่บังคับ foreign key บางตัว เพื่อไม่ให้ระบบล้มระหว่างซ่อม schema
- หลังระบบใช้งานได้แล้ว ควรตรวจข้อมูล legacy และค่อยเพิ่ม constraint แบบเข้มงวดในรอบถัดไป
