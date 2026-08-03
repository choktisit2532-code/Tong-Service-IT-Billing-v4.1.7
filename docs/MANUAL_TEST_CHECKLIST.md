# Manual Test Checklist v4.1.7

## Auth

- [ ] Login admin ได้
- [ ] Login staff ได้
- [ ] Login viewer ได้
- [ ] `/api/auth/me` มี `permissions`

## Permission

- [ ] viewer เห็นข้อมูลแต่แก้ไขไม่ได้
- [ ] viewer เรียก API create/update แล้วได้ 403
- [ ] staff สร้างลูกค้า/สินค้า/เอกสารได้
- [ ] staff เข้า Settings/User/Backup/Audit Export ไม่ได้ถ้าไม่มีสิทธิ์
- [ ] admin ใช้งานได้ทั้งหมด

## Documents UX

- [ ] สร้างเอกสารมี 5 แถวเริ่มต้น
- [ ] เลือกลูกค้าอยู่ด้านบน
- [ ] Dropdown เปลี่ยนสถานะทำงาน
- [ ] Cancel/Delete มี Modal เหตุผล
- [ ] Drag & Drop รายการสินค้าแล้วบันทึกตามลำดับ

## Reports

- [ ] เลือก start_date/end_date ได้
- [ ] โหลด Advanced Reports ได้
- [ ] มีตาราง Revenue, Receivables, Withholding, Transfer Fee, Top Customers, Cancelled Documents
- [ ] มีกราฟ Revenue / Sales by Type / Aging
- [ ] Export CSV ได้
- [ ] Print/PDF ผ่าน Browser ได้

## Audit Log

- [ ] เข้าเมนู Audit Log ได้เฉพาะผู้มี `audit.view`
- [ ] Filter action/entity/search ได้
- [ ] Export Audit CSV ได้เฉพาะผู้มี `audit.export`

## Deploy

- [ ] Backend Render `/api/health` ใช้งานได้
- [ ] Frontend Cloudflare Pages login ได้
- [ ] Supabase migration ผ่าน
- [ ] CORS ไม่ error
