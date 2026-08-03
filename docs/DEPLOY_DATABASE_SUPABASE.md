# Deploy Database บน Supabase PostgreSQL

## 1. สร้าง Project

สร้าง Supabase Project ใหม่ แล้วไปที่ Project Settings > Database เพื่อคัดลอก Connection string

แนะนำใช้ Transaction pooler ถ้าเชื่อมจาก Render:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

## 2. รัน Migration

```bash
cd backend
npm ci
npm run db:migrate
npm run db:check
```

## 3. สร้าง Admin

```bash
npm run create-admin
```

## 4. ตรวจตารางสำคัญ

ควรมีตาราง:

- users
- customers
- products
- documents
- document_items
- document_relations
- audit_logs
- settings
- schema_migrations

## 5. ข้อควรระวัง

- ห้าม commit `DATABASE_URL` จริงลง Git
- `.env` จริงไม่ควรอยู่ใน Release ZIP
- ถ้า migrate ล้มเหลว ให้ตรวจ `schema_migrations` ก่อนรันซ้ำ
