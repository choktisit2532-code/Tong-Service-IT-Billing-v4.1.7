# Deploy Frontend v4.1.7 บน Render

ใช้กับ Render Static Site เดิม `tongserviceit-2` โดยตั้งค่าดังนี้

- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Environment Variable:
  - `API_BASE_URL=https://tong-service-it-billing-v4-1-6-deploy.onrender.com/api`

หลัง Deploy ให้เปิด `https://tongserviceit-2.onrender.com/app.html` และกด Hard Refresh (`Ctrl+F5`)

รายการตรวจสอบหลัง Deploy

- หน้าสร้างเอกสารมีปุ่ม `รีเฟรชรายชื่อ` และ `+ เพิ่มลูกค้าใหม่`
- ใบเสนอราคาและใบวางบิลแสดงค่าเริ่มต้น 15 วัน
- ใบเสร็จสถานะรอยืนยันมีปุ่ม `ยืนยันรับชำระ`
- งานพิมพ์โหลดไฟล์ `assets/fonts/sarabun-thai-400-normal.woff2` และ `sarabun-thai-700-normal.woff2`
