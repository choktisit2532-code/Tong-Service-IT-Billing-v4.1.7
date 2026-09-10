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
  const fixture = documentFixture(type);
  if (type === 'RC') {
    fixture.grand_total = 500;
    fixture.net_total = 400;
    fixture.receipt_payment_type = 'PARTIAL';
    fixture.receipt_source_items = fixture.items.map((item) => ({ ...item }));
    fixture.receipt_source_items[1].description = 'รายละเอียดจากใบแจ้งหนี้ต้นทาง';
    fixture.payment_summary = {
      source_number:'IN-6908-001', source_subtotal:3000, source_discount:0,
      source_total:3000, paid_before:0, current_payment:500, remaining_after:2500
    };
  }
  const workbook = await buildExcelWorkbook(fixture, { ExcelJS, imageResolver });
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
  const formulaCells = [];
  sheet.eachRow((row) => row.eachCell((cell) => {
    if (cell.value?.formula) formulaCells.push(cell.value.formula);
  }));
  assert.ok(formulaCells.some((formula) => formula.includes('BAHTTEXT(')), `${type} is missing a dynamic BAHTTEXT formula`);
  if (type === 'RC') {
    assert.equal(sheet.getCell('B14').value, 'รายละเอียดจากใบแจ้งหนี้ต้นทาง');
    let paymentRow = null;
    sheet.eachRow((row) => {
      if (row.getCell(5).value === 'ยอดชำระบางส่วน') paymentRow = row.number;
    });
    assert.ok(paymentRow, 'Receipt summary is missing the current payment row');
    assert.equal(sheet.getCell(`F${paymentRow}`).value, 500);
    const remainingLabels = [];
    sheet.eachRow((row) => remainingLabels.push(row.getCell(5).value));
    assert.ok(remainingLabels.includes('ยอดคงเหลือหลังรับชำระ'), 'Partial receipt must show its remaining balance');
    assert.ok(formulaCells.some((formula) => /BAHTTEXT\(F\d+\)/.test(formula)), 'Receipt BAHTTEXT does not reference a live amount cell');
  }
  const bytes = await workbook.xlsx.writeBuffer();
  assert.ok(bytes.byteLength > 5_000);
  if (type === 'RC') receiptWorkbook = workbook;
}

const directReceipt = documentFixture('RC');
directReceipt.grand_total = 500;
directReceipt.net_total = 400;
const directReceiptWorkbook = await buildExcelWorkbook(directReceipt, { ExcelJS, imageResolver });
const directReceiptSheet = directReceiptWorkbook.worksheets[0];
let directNetRow = null;
directReceiptSheet.eachRow((row) => {
  if (row.getCell(5).value === 'ยอดรับสุทธิ') directNetRow = row.number;
});
assert.ok(directNetRow, 'Direct receipt is missing the net receipt row');
assert.equal(directReceiptSheet.getCell(`F${directNetRow}`).value, 400);
const directBahtFormula = directReceiptSheet.getCell(`A${directNetRow - 2}`).value?.formula;
assert.ok(directBahtFormula?.includes(`BAHTTEXT(F${directNetRow})`), 'Direct receipt BAHTTEXT must reference the net receipt cell without deducting twice');

const fullReceipt = documentFixture('RC');
fullReceipt.receipt_payment_type = 'FULL';
fullReceipt.grand_total = 3000;
fullReceipt.net_total = 2900;
fullReceipt.receipt_source_items = fullReceipt.items.map((item) => ({ ...item }));
fullReceipt.payment_summary = {
  source_number:'IN-6908-002', source_subtotal:3000, source_discount:0,
  source_total:3000, paid_before:0, current_payment:3000, remaining_after:0
};
const fullReceiptWorkbook = await buildExcelWorkbook(fullReceipt, { ExcelJS, imageResolver });
const fullReceiptLabels = [];
fullReceiptWorkbook.worksheets[0].eachRow((row) => fullReceiptLabels.push(row.getCell(5).value));
assert.ok(!fullReceiptLabels.includes('ยอดคงเหลือหลังรับชำระ'), 'Full receipt with zero balance must hide the remaining balance row');

const finalInstallment = { ...fullReceipt, receipt_payment_type:'INSTALLMENT', installment_number:3, installment_count:3 };
const finalInstallmentWorkbook = await buildExcelWorkbook(finalInstallment, { ExcelJS, imageResolver });
const finalInstallmentRows = [];
finalInstallmentWorkbook.worksheets[0].eachRow((row) => {
  if (row.getCell(5).value === 'ยอดคงเหลือหลังรับชำระ') finalInstallmentRows.push(row.number);
});
assert.equal(finalInstallmentRows.length, 1, 'Final installment must keep the zero remaining balance row');
assert.equal(finalInstallmentWorkbook.worksheets[0].getCell(`F${finalInstallmentRows[0]}`).value, 0);

// Verify dateMode: 'hide' clears date cells
const hideDateDo = documentFixture('DO');
hideDateDo.due_date = null;
const hideDateWorkbook = await buildExcelWorkbook(hideDateDo, { ExcelJS, imageResolver, dateMode:'hide' });
const hideDateSheet = hideDateWorkbook.worksheets[0];
assert.equal(hideDateSheet.getCell('E4').value, '', 'dateMode: hide must clear E4 label');
assert.equal(hideDateSheet.getCell('F4').value, '', 'dateMode: hide must clear F4 value');
assert.equal(hideDateSheet.getCell('E5').value, '', 'dateMode: hide without due_date must clear E5');
assert.equal(hideDateSheet.getCell('F5').value, '', 'dateMode: hide without due_date must clear F5');

// Verify dateMode: 'dots' displays dotted line
const dotsDateQt = documentFixture('QT');
const dotsDateWorkbook = await buildExcelWorkbook(dotsDateQt, { ExcelJS, imageResolver, dateMode:'dots' });
const dotsDateSheet = dotsDateWorkbook.worksheets[0];
assert.equal(dotsDateSheet.getCell('E4').value, 'วันที่', 'dateMode: dots must keep E4 as วันที่');
assert.ok(String(dotsDateSheet.getCell('F4').value).includes('...'), 'dateMode: dots must show dotted line in F4');

if (process.env.EXCEL_PREVIEW_OUTPUT && receiptWorkbook) {
  const output = path.resolve(process.env.EXCEL_PREVIEW_OUTPUT);
  await fs.mkdir(path.dirname(output), { recursive:true });
  await receiptWorkbook.xlsx.writeFile(output);
  console.log(`Excel preview: ${output}`);
}

console.log('Excel export checks passed for QT, IN, BN, RC and DO');
