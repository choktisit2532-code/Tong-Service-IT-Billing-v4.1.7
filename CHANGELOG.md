# v4.1.23 Document History Product Auto-Fill

- เพิ่ม `/api/products/suggestions` สำหรับรวมสินค้า/บริการจากคลังกับรายการจริงในเอกสารเก่า
- รวมชื่อซ้ำแบบไม่สนตัวพิมพ์และช่องว่าง โดยใช้ประเภท หน่วย และราคาจากเอกสารที่ใช้งานล่าสุด
- รองรับรายการจากเอกสารเก่าที่ไม่มี `product_id` และเอกสารที่สร้างก่อนมีระบบ Auto-Fill
- ไม่ดึงชื่อที่ถูกปิดใช้งานในคลังกลับมาจากประวัติ และยังรองรับข้อมูลเก่าที่ `active = NULL`
- โหลดรายการแนะนำใหม่ทุกครั้งที่เปิดหน้าสร้างเอกสาร โดยไม่ทำให้ Modal เปิดช้า
- ไม่เปลี่ยนฐานข้อมูล ธีม การเรียงรายการ Excel หรือ Workflow DO → IN

# v4.1.22 Direct Document Item Reordering

- เปลี่ยนการจัดลำดับรายการเป็นปุ่มขึ้น–ลงและช่องกรอกเลขลำดับ ใช้งานได้ทันทีโดยไม่ต้องปลดล็อก
- เพิ่มปุ่มย้อนกลับการเรียงล่าสุด และปรับสถานะปุ่มบน–ล่างอัตโนมัติตามตำแหน่งจริง
- คงไอคอน 6 จุดไว้เป็นทางเลือกลากด้วยเมาส์ โดยเปิดลากเฉพาะขณะกดค้างที่ไอคอน
- ปรับปุ่มจัดลำดับบนมือถือให้มีขนาดแตะง่าย และไม่รบกวนช่องกรอกข้อมูล
- ไม่แก้ข้อมูลเดิม, ฐานข้อมูล, ธีม, Auto-Fill, DO → IN หรือ Workflow เอกสารอื่น

# v4.1.21 Document Customer Dropdown Recovery

- Added a dedicated unpaginated `/api/customers/document-options` endpoint for document forms.
- The endpoint includes legacy customers with `active = NULL` and excludes only records explicitly set to `false`.
- Removed the document dropdown's dependency on customer-list status filters, pagination, and cached list responses.
- Added an explicit favicon to stop the unrelated `/favicon.ico` 404 console warning.
- Preserved all v4.1.20 Auto-Fill, product memory, DO → IN, and drag-order improvements.

# v4.1.20 Document Item Drag Reliability Hotfix

- แก้การลากสลับลำดับรายการบน Chrome ให้กำหนด `draggable` ที่แถวรายการจริง เฉพาะขณะกดค้างไอคอน 6 จุด
- ปล่อยเมาส์, วางรายการ หรือออกจากหน้าต่างเบราว์เซอร์แล้วล็อกแถวนั้นกลับทันที
- คงสวิตช์ปลดล็อกไว้สำหรับลากรายการถัดไป แต่ไม่ปล่อยให้แถวใดลากได้ค้างโดยไม่ตั้งใจ
- ไม่แก้ฐานข้อมูล, ธีม, Excel หรือ Workflow เอกสารอื่น

# v4.1.13 Customer Dropdown Deployment Compatibility Hotfix

- หน้าสร้างเอกสารดึงรายชื่อลูกค้าทั้งหมด แล้วคัดเฉพาะลูกค้าที่ปิดใช้งานจริง (`active = FALSE`) ที่หน้าเว็บ
- รองรับทั้ง Backend รุ่นใหม่และ Backend ที่ยังตีความ `active = NULL` ผิดเมื่อเรียก `status=active`
- คงการไม่แสดงลูกค้าที่ถูกปิดใช้งานจริง และไม่แก้ข้อมูลหรือโครงสร้างฐานข้อมูล

# v4.1.11 Legacy Customer List Hotfix

- ให้ลูกค้าเก่าที่ `active` เป็น `NULL` แสดงในรายชื่อและ Dropdown ออกเอกสารตามปกติ
- ลูกค้าเก่าสามารถแก้ไขและปิดใช้งานได้ โดยยังถือว่าปิดใช้งานเฉพาะเมื่อ `active = FALSE`
- พับและล้างฟอร์มเพิ่มลูกค้าด่วนทุกครั้งที่เปิดหน้าสร้างเอกสาร ป้องกันฟอร์มค้างและบีบพื้นที่
- ไม่แก้ฐานข้อมูล รูปแบบ Excel ธีม หรือ Workflow เอกสารส่วนอื่น

## v4.1.10 Source Document Selection Hotfix

- ปิด Browser/Proxy Cache สำหรับ API รายการเอกสารต้นทาง ป้องกัน `304` ทำให้รายการไม่อัปเดต
- โหลดรายการต้นทางใหม่ทุกครั้งเมื่อเปลี่ยนลูกค้าหรือประเภทเอกสาร
- เพิ่มสถานะกำลังโหลด ข้อความอธิบายเมื่อไม่มีเอกสาร และปุ่ม `โหลดใหม่`
- เมื่อสร้างเอกสารต่อจากใบเดิม ระบบเลือกต้นทางให้อัตโนมัติและแจ้งชัดเจนหากใบนั้นใช้ไม่ได้
- คงกฎห้ามใช้เอกสารที่ยกเลิก ปฏิเสธ ชำระแล้ว หรือถูกนำไปใช้งานซ้ำตาม Workflow

## v4.1.9 General Invoice & Item Position Lock

- เปิดใบแจ้งหนี้สำหรับลูกค้าบุคคลทั่วไป โดยไม่บังคับเลขประจำตัวผู้เสียภาษี
- รองรับ QT → IN → RC และ IN → RC สำหรับลูกค้าบุคคลทั่วไป
- เพิ่มสวิตช์ล็อกตำแหน่งรายการ ค่าเริ่มต้นเป็นล็อก
- ปลดล็อกแล้วลากย้ายได้เฉพาะไอคอนด้านซ้าย ลดการเลื่อนแถวระหว่างกรอกข้อมูล
- โหลดรายชื่อลูกค้าใหม่จากรายการที่เปิดใช้งานทุกครั้งก่อนเปิดฟอร์มเอกสาร พร้อม fallback จากข้อมูลที่โหลดตอนเข้าระบบ
- คง Preview A4, Excel Export, Hotfix วันที่เอกสาร และกฎต้นทาง–ปลายทางจาก v4.1.8

## v4.1.8 A4 Preview, Excel Export & Document Date Hotfix

- แสดง Preview เป็นกระดาษ A4 แยกหน้าตรงกับ Print/PDF
- แบ่งรายการหลายหน้าอัตโนมัติ พร้อมหัวตารางซ้ำและเลขหน้า
- เตือนจำนวนหน้าก่อนพิมพ์ โดยไม่ลบรายการจากฐานข้อมูล
- เพิ่ม Export `.xlsx` สำหรับจัดรูปแบบสำเนาภายนอก
- เพิ่ม API ตรวจผลกระทบเอกสารต้นทาง–ปลายทาง
- เพิ่มการแก้วันที่เอกสารแบบ Metadata โดยไม่ส่งหรือแก้รายการสินค้า
- เลือกคำนวณวันครบกำหนดใหม่จากจำนวนวันเครดิตเดิมได้
- เก็บวันที่และข้อมูลประกอบก่อน–หลังไว้ใน Audit Log
- คง `customer_id` เดิมเมื่อเปิดเอกสารมาแก้ไข

# v4.1.7 Database Compatibility Hotfix

- Added `009_schema_compat_backfill.sql` for databases with missing tables/columns.
- Added full schema doctor command: `npm run db:doctor`.
- Expanded schema readiness checks beyond document columns.
- Kept migration idempotent and non-destructive.

# v4.1.7 Finalization Hotfix

- Added Dashboard and Advanced Report short-cache optimization.
- Added report payload limit guard.
- Added frontend double-click/busy-state hardening.
- Added print/PDF watermarks and page-break safeguards.
- Added permission audit tests.
- Added backup/restore scripts and restore API.
- Added PM2, Nginx, systemd examples and production readiness checklist.

# Changelog

## v4.1.7

### Security / Foundation Fixes

- ปรับ `backend/package.json`, `frontend/package.json`, `package-lock.json` และ `VERSION` เป็น `4.1.7`
- ปรับ `backend/server.js` ให้ Backend start ได้แม้ Database ยังไม่พร้อม และปิดระบบแบบ graceful พร้อม timeout
- แยก Health Check เป็น `/api/health` สำหรับ liveness และ `/api/health/ready` สำหรับ database/schema readiness
- เพิ่ม Login Rate Limit เฉพาะ `/api/auth/login` จำนวน 5 ครั้งต่อ 15 นาที
- เพิ่ม Audit Log สำหรับ `auth.login.success` และ `auth.login.failed` พร้อม IP และ user agent โดยไม่บันทึกรหัสผ่าน
- ปรับ Node Engine จาก `22.x` เป็น `>=20 <23`

### Changed

- ปรับปรุงหน้าตาระบบ (UI refresh) โทน minimal น้ำเงิน/เขียว สำหรับธีม light
  - Sidebar โทนเข้ม พร้อมเมนู active แบบไล่เฉดน้ำเงิน–เขียว
  - Stat card เพิ่มแถบสีด้านซ้ายและ hover ยกตัว
  - Status badge ปรับ contrast ให้อ่านชัดบนพื้นสว่าง (ผ่านเกณฑ์ WCAG AA)
  - เพิ่มลูกเล่น hover ที่ workflow card, insight card และปุ่มหลัก
  - เคารพ `prefers-reduced-motion` สำหรับผู้ใช้ที่ปิดแอนิเมชัน
- การปรับทั้งหมดทำผ่าน CSS เท่านั้น ไม่แก้ HTML หรือ JavaScript
- ธีมอื่น (dark, amber, ocean, softgreen, lavender, rose) ยังคงทำงานเหมือนเดิม

### Fixed

- แก้เวอร์ชันใน `/api/health` ที่ hardcode เป็น `4.0.0` ให้ดึงจาก `package.json` โดยตรง

### Notes

- ส่วนปรับปรุงหน้าตาเน้นที่ธีม light เป็นหลัก ธีม dark และหน้าพิมพ์ (print/PDF) ยังไม่ได้ปรับในรอบนี้
- หากต้องการย้อนกลับดีไซน์เดิม ลบบล็อก "v4.1.6 — Minimal Refresh" ท้ายไฟล์ `frontend/src/css/styles.css`

## v4.1.6 Deploy Ready

### Added

- Advanced Reports module
  - Revenue by date range
  - Receivables
  - Receivables Aging
  - Withholding Tax from RC documents
  - Transfer Fees
  - Top Customers
  - Sales by Type from `document_items.item_type`
  - Cancelled Documents with cancellation reason
- CSV Export for Advanced Reports
- Permission Layer with permission keys and role fallback
- Backend authorization for dashboard, documents, reports, audit, settings, users, backup
- Frontend permission hiding through `data-permission`
- Audit Log page with filters and CSV export
- Deploy documentation for Render, Cloudflare Pages and Supabase
- Production Checklist and Troubleshooting docs

### Changed

- Version updated to 4.1.6
- `/api/reports/monthly` moved to service layer and `/api/reports/advanced` added
- `/api/auth/me` returns permission list from role mapping
- `authorize.js` now supports both legacy roles and permission keys

### Fixed / Hardened

- Backend is the final permission enforcement layer; Frontend only hides buttons for UX
- Report tax logic uses RC documents for actual withholding data

### Known Issues

- XLSX export is not included; current release uses CSV and browser Print/PDF
- Server-side PDF generation is not included
- Full user-managed custom permissions are not included yet; this release uses role-to-permission mapping

## v4.1.7 Fixed Sprint 1B - Backend Hardening

### Added
- เพิ่ม structured JSON logger ที่ `backend/src/utils/logger.js` พร้อม redaction สำหรับ password/token/secret/authorization/cookie
- เพิ่ม request context middleware ที่สร้าง `X-Request-Id` ให้ทุก request
- เพิ่ม request logging พร้อม method, path, status code, duration, IP และ user agent
- เพิ่ม environment configuration สำหรับ `LOG_LEVEL`, `TRUST_PROXY`, body limit, API rate limit, login rate limit และ database timeout

### Changed
- ปรับ `server.js` ให้ใช้ structured logger แทน `console.log/console.warn/console.error`
- ปรับ database pool error logging ให้ปลอดภัยและอ่านง่ายขึ้น
- ปรับ global rate limit และ login rate limit ให้อ่านค่าจาก environment variables
- ปรับ error response ให้แนบ `requestId` เพื่อใช้ตรวจสอบ log ได้ง่ายขึ้น
- ปรับ JSON parse error และ CORS error ให้ตอบ error code ที่ชัดเจน

### Security
- เพิ่ม validation กันการใช้ placeholder `JWT_SECRET` ใน production
- เพิ่ม validation กันการใส่ localhost ใน `CORS_ORIGINS` เมื่อเป็น production
- เพิ่ม redaction ของข้อมูลลับใน logger
- เพิ่ม `Referrer-Policy: no-referrer` ผ่าน Helmet

### Operational
- เพิ่ม `unhandledRejection` และ `uncaughtException` logging
- เพิ่ม database connection timeout/idle timeout ที่ตั้งค่าผ่าน `.env`

## Hotfix: Customer Code Auto Number

- ปรับรหัสลูกค้าให้ระบบสร้างอัตโนมัติ เริ่มจาก `0001` และเพิ่มทีละ 1
- ผู้ใช้ไม่ต้องกรอกรหัสลูกค้าเอง ช่องรหัสลูกค้าในฟอร์มเป็น read-only
- Backend ใช้ transaction lock เพื่อป้องกันเลขซ้ำเมื่อเพิ่มลูกค้าพร้อมกัน
- เพิ่ม migration `008_customer_code_autonumber.sql` สำหรับเติมรหัสลูกค้าเดิมที่ยังไม่มีรหัส
