import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildExcelWorkbook } from '../src/js/excel-export.js';

const typeTotals = {
  QT:{ withholding_amount:0, transfer_fee:0, net_total:3000 },
  IN:{ withholding_amount:0, transfer_fee:0, net_total:3000 },
  BN:{ withholding_amount:0, transfer_fee:0, net_total:3000 },
  RC:{ withholding_amount:90, transfer_fee:10, net_total:2900 },
  DO:{ withholding_amount:0, transfer_fee:0, net_total:3000 }
};

function documentFixture(documentType) {
  return {
    document_type:documentType,
    document_number:`${documentType}-6908-001`,
    document_date:'2026-08-03',
    due_date:'2026-08-18',
    status:'PENDING',
    subtotal:3000,
    discount:0,
    withholding_rate:3,
    show_signature:false,
    remarks:'กรุณาตรวจสอบรายการก่อนรับสินค้า',
    payment_terms:'ชำระภายใน 15 วัน',
    delivery_days:3,
    quotation_validity_days:15,
    payment_received_date:'2026-08-03',
    withholding_certificate_number:'WT-6908-001',
    withholding_certificate_date:'2026-08-03',
    ...typeTotals[documentType],
    customer_snapshot:{
      name:'บริษัท ตัวอย่าง จำกัด',
      customer_type:'private',
      tax_id:'0105559999999',
      branch_name:'สำนักงานใหญ่',
      address:'99/9 ถนนตัวอย่าง ตำบลตัวอย่าง อำเภอเมือง จังหวัดกระบี่ 81000',
      email:'customer@example.com',
      phone:'081-234-5678'
    },
    settings:{
      shop_name_th:'ต้อง เซอร์วิสไอที',
      shop_name_en:'TONG SERVICE IT',
      shop_owner:'นายทดสอบ ระบบงาน',
      shop_address:'445 หมู่ 5 ถนนเพชรเกษม ตำบลโคกยาง อำเภอเหนือคลอง จังหวัดกระบี่ 81130',
      shop_tax_id:'1810100134131',
      shop_phone:'086-473-3795',
      shop_email:'tong@example.com',
      scb_bank_details:'ธนาคารไทยพาณิชย์ เลขที่บัญชี 000-0-00000-0\nชื่อบัญชี ต้อง เซอร์วิสไอที',
      ktb_bank_details:''
    },
    items:[
      { line_type:'section', description:'สินค้าและบริการ' },
      { line_type:'item', description:'SSD 256 GB Lexar', quantity:1, unit:'ตัว', unit_price:1500, line_total:1500 },
      { line_type:'item', description:'คีย์บอร์ด ASUS X512D', quantity:1, unit:'ตัว', unit_price:1000, line_total:1000 },
      { line_type:'item', description:'ลงวินโดว์ 10 Pro', quantity:1, unit:'เครื่อง', unit_price:300, line_total:300 },
      { line_type:'item', description:'ค่าซ่อมคอมตั้งโต๊ะ', quantity:1, unit:'ตัว', unit_price:200, line_total:200 },
      { line_type:'note', description:'รับประกันงานบริการ 30 วัน', text_style:'normal' }
    ]
  };
}

const imageResolver = async () => null;
let receiptWorkbook;
for (const type of Object.keys(typeTotals)) {
  const workbook = await buildExcelWorkbook(documentFixture(type), { ExcelJS, imageResolver });
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.pageSetup.paperSize, 9);
  assert.equal(sheet.pageSetup.orientation, 'portrait');
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.match(sheet.pageSetup.printArea, /^A1:F\d+$/);
  assert.equal(sheet.getColumn(1).width, 13);
  assert.equal(sheet.getColumn(2).width, 33);
  assert.equal(sheet.getCell('A1').value, 'โลโก้ร้าน');
  assert.equal(sheet.getCell('B3').font.size, 14);
  assert.equal(sheet.getCell('B4').font.size, 14);
  assert.match(sheet.getCell('B4').value, /1810100134131/);
  assert.equal(sheet.getCell('F8').value, '0105559999999');
  assert.equal(sheet.getCell('F8').numFmt, '@');
  assert.equal(sheet.getCell('A12').value, 'ลำดับ');
  assert.equal(sheet.getCell('F14').value.formula, 'IF(OR(C14="",E14=""),"",C14*E14)');
  assert.ok(sheet.getCell('F19').value.formula?.startsWith('SUM('));
  const bytes = await workbook.xlsx.writeBuffer();
  assert.ok(bytes.byteLength > 5_000);
  if (type === 'RC') receiptWorkbook = workbook;
}

if (process.env.EXCEL_PREVIEW_OUTPUT && receiptWorkbook) {
  const output = path.resolve(process.env.EXCEL_PREVIEW_OUTPUT);
  await fs.mkdir(path.dirname(output), { recursive:true });
  await receiptWorkbook.xlsx.writeFile(output);
  console.log(`Excel preview: ${output}`);
}

console.log('Excel export checks passed for QT, IN, BN, RC and DO');
