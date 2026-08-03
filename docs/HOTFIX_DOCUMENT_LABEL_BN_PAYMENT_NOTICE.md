# Hotfix: Rename BN Document Label to ใบแจ้งยอดชำระ

## Summary
ปรับคำเรียกเอกสารประเภท `BN` จากคำเดิม `ใบวางบิล` / `วางบิล` ให้เป็นชื่อที่ถูกต้องคือ `ใบแจ้งยอดชำระ` โดยยังคงใช้ document type code `BN` เดิม เพื่อไม่กระทบฐานข้อมูลและ workflow เดิม

## Scope
- Frontend menu, filter, workflow action, document type card
- Chart labels and document labels
- Print document title and signature wording
- Backend validation/error messages
- User-facing service error messages

## Notes
- ไม่มีการเปลี่ยนรหัสเอกสาร `BN`
- ไม่มี migration ใหม่ เพราะเป็นการแก้ label และข้อความแสดงผลเท่านั้น
- Logic จาก Private Billing / Receipt Workflow Hotfix ยังคงอยู่ครบ
