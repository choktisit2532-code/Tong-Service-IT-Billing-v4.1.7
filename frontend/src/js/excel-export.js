import { DOC_LABELS, dateThai, thaiBahtText } from './utils.js';

const TYPE_THEME = {
  QT: { soft:'EAF2FF', soft2:'F5F8FF', strong:'315F9E', border:'7595BF' },
  IN: { soft:'FFF3D6', soft2:'FFFAF0', strong:'8A5A00', border:'C39A4A' },
  BN: { soft:'F2EAFE', soft2:'FAF7FF', strong:'67459A', border:'9B7EC2' },
  RC: { soft:'E7F6EC', soft2:'F5FBF7', strong:'2F774A', border:'6FA983' },
  DO: { soft:'E5F6F5', soft2:'F4FBFB', strong:'267277', border:'68A4A7' }
};

const FONT_NAME = 'TH Sarabun New';
const CURRENCY_FORMAT = '#,##0.00;[Red]-#,##0.00';
const MIN_ITEM_ROWS = 6;

function argb(hex) {
  return `FF${String(hex).replace('#', '').toUpperCase()}`;
}

function numeric(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFilename(value) {
  return String(value || 'document').replace(/[\\/:*?"<>|]/g, '-').trim() || 'document';
}

function safeWorksheetName(value) {
  return String(value || 'เอกสาร').replace(/[\\/:*?\[\]]/g, '-').slice(0, 31) || 'เอกสาร';
}

function setValue(cell, value, options = {}) {
  cell.value = value ?? '';
  cell.font = { name:FONT_NAME, size:options.size || 14, bold:Boolean(options.bold), color:{ argb:argb(options.color || '111827') } };
  cell.alignment = {
    vertical:'middle',
    horizontal:options.align || 'left',
    wrapText:options.wrap !== false
  };
  if (options.fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:argb(options.fill) } };
  if (options.numberFormat) cell.numFmt = options.numberFormat;
}

function borderRange(sheet, range, color, style = 'thin') {
  const cells = sheet.getCell(range.split(':')[0]);
  const end = sheet.getCell(range.split(':')[1] || range.split(':')[0]);
  for (let row = cells.row; row <= end.row; row += 1) {
    for (let col = cells.col; col <= end.col; col += 1) {
      sheet.getCell(row, col).border = {
        top:{ style, color:{ argb:argb(color) } },
        left:{ style, color:{ argb:argb(color) } },
        bottom:{ style, color:{ argb:argb(color) } },
        right:{ style, color:{ argb:argb(color) } }
      };
    }
  }
}

function mergeAndSet(sheet, range, value, options = {}) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  setValue(cell, value, options);
  return cell;
}

function addImageToSheet(workbook, sheet, image, range) {
  if (!image?.base64 || !image?.extension) return;
  const imageId = workbook.addImage({ base64:image.base64, extension:image.extension });
  sheet.addImage(imageId, range);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function convertToPng(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function resolveExcelImage(source) {
  const value = String(source || '').trim();
  if (!value) return null;

  try {
    let dataUrl = value;
    if (!value.startsWith('data:image/')) {
      const response = await fetch(value, { cache:'no-store', mode:'cors' });
      if (!response.ok) return null;
      dataUrl = await blobToDataUrl(await response.blob());
    }

    const type = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,/i)?.[1]?.toLowerCase();
    if (!type) return null;
    if (type === 'webp') dataUrl = await convertToPng(dataUrl);
    return {
      base64:dataUrl,
      extension:type === 'jpg' || type === 'jpeg' ? 'jpeg' : 'png'
    };
  } catch {
    return null;
  }
}

function receiptAmountLabel(doc) {
  if (doc.installment_number) {
    return doc.installment_count
      ? `ยอดชำระงวดที่ ${doc.installment_number}/${doc.installment_count}`
      : `ยอดชำระงวดที่ ${doc.installment_number}`;
  }
  const paymentType = doc.receipt_payment_type;
  if (paymentType === 'DEPOSIT') return 'ยอดรับมัดจำ';
  if (paymentType === 'PARTIAL') return 'ยอดชำระบางส่วน';
  if (paymentType === 'INSTALLMENT') return 'ยอดชำระตามงวด';
  return 'รับชำระครั้งนี้';
}

function documentSummaryLabel(doc) {
  if (doc.document_type === 'RC') return numeric(doc.withholding_amount) > 0 || numeric(doc.transfer_fee) > 0 ? 'ยอดรับสุทธิ' : receiptAmountLabel(doc);
  if (doc.document_type === 'BN') return 'ยอดรวมใบวางบิล';
  if (doc.document_type === 'IN') return 'ยอดรวมใบแจ้งหนี้';
  return 'รวมสุทธิ';
}

function signatureLayout(type) {
  if (type === 'BN') return [
    { range:'A:C', title:'ผู้รับใบวางบิล / Recipient', detail:'ลงชื่อ ........................................' },
    { range:'D:F', title:'ผู้ออกใบวางบิล', issuer:true }
  ];
  if (type === 'DO') return [
    { range:'A:C', title:'ผู้รับของ / Receiver', detail:'ได้รับสินค้าตามรายการถูกต้องแล้ว\nลงชื่อ ........................................' },
    { range:'D:F', title:'ผู้ส่งของ / Delivered By', issuer:true }
  ];
  const title = type === 'QT' ? 'ผู้เสนอราคา' : type === 'RC' ? 'ผู้รับเงิน' : 'ผู้จัดทำเอกสาร';
  return [{ range:'D:F', title, issuer:true }];
}

function formulaCell(cell, formula, result, options = {}) {
  cell.value = { formula, result };
  cell.font = { name:FONT_NAME, size:options.size || 14, bold:Boolean(options.bold), color:{ argb:argb(options.color || '111827') } };
  cell.alignment = { vertical:'middle', horizontal:options.align || 'right', wrapText:true };
  if (options.numberFormat) cell.numFmt = options.numberFormat;
  if (options.fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:argb(options.fill) } };
}

export async function buildExcelWorkbook(doc, options = {}) {
  const ExcelJS = options.ExcelJS || window.ExcelJS;
  if (!ExcelJS?.Workbook) throw new Error('ไม่พบตัวสร้างไฟล์ Excel');

  const theme = options.monochrome
    ? { soft:'EEEEEE', soft2:'F8F8F8', strong:'000000', border:'666666' }
    : (TYPE_THEME[doc.document_type] || TYPE_THEME.QT);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = doc.settings?.shop_name_th || 'Tong Service IT';
  workbook.company = doc.settings?.shop_name_en || 'Tong Service IT';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `เอกสาร ${DOC_LABELS[doc.document_type] || doc.document_type}`;
  workbook.title = doc.document_number || DOC_LABELS[doc.document_type];
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;

  const sheet = workbook.addWorksheet(safeWorksheetName(DOC_LABELS[doc.document_type]), {
    properties:{ defaultRowHeight:21 },
    views:[{ showGridLines:false, zoomScale:90 }],
    pageSetup:{
      paperSize:9,
      orientation:'portrait',
      fitToPage:true,
      fitToWidth:1,
      fitToHeight:0,
      horizontalCentered:true,
      margins:{ left:0.28, right:0.28, top:0.35, bottom:0.42, header:0.1, footer:0.15 }
    }
  });
  sheet.headerFooter.oddFooter = `&L${safeFilename(doc.document_number)}&Rหน้า &P / &N`;
  sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
  sheet.columns = [
    { key:'sequence', width:13 },
    { key:'description', width:33 },
    { key:'quantity', width:12 },
    { key:'unit', width:11 },
    { key:'unit_price', width:16 },
    { key:'amount', width:18 }
  ];

  const settings = doc.settings || {};
  const customer = doc.customer_snapshot || {};
  const shopName = [settings.shop_name_th, settings.shop_name_en].filter(Boolean).join(' ');
  const contactNumber = String(settings.shop_phone || '0864733795').replace(/\D/g, '') || '0864733795';
  const usesSourceDetails = doc.document_type === 'RC' && doc.payment_summary && doc.receipt_source_items?.length;
  const displayItems = usesSourceDetails ? doc.receipt_source_items : (doc.items || []);
  const displaySubtotal = usesSourceDetails ? numeric(doc.payment_summary.source_subtotal) : numeric(doc.subtotal);
  const displayDiscount = usesSourceDetails ? numeric(doc.payment_summary.source_discount) : numeric(doc.discount);
  const displayGrandTotal = usesSourceDetails ? numeric(doc.payment_summary.source_total) : numeric(doc.net_total);
  const imageResolver = options.imageResolver || resolveExcelImage;
  const [logo, signature] = await Promise.all([
    imageResolver(settings.logo_url),
    doc.show_signature
      ? imageResolver(doc.signatures?.find((item) => item.role === 'issuer')?.signature_url || settings.saved_signature_url)
      : Promise.resolve(null)
  ]);

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = Math.max(36, 22 + Math.ceil(String(settings.shop_address || '').length / 70) * 12);
  sheet.getRow(4).height = 24;
  sheet.getRow(5).height = 24;
  sheet.getRow(6).height = 7;
  mergeAndSet(sheet, 'A1:A5', logo ? '' : 'โลโก้ร้าน', { size:12, align:'center', bold:true, color:theme.strong, fill:theme.soft });
  borderRange(sheet, 'A1:A5', theme.border);
  addImageToSheet(workbook, sheet, logo, 'A2:A4');

  mergeAndSet(sheet, 'B1:D1', shopName || 'ชื่อร้าน', { size:19, bold:true, color:theme.strong, fill:theme.soft });
  mergeAndSet(sheet, 'B2:D2', '', { size:14, bold:true, color:theme.strong, fill:theme.soft });
  mergeAndSet(sheet, 'B3:D3', settings.shop_address || '', { size:14, fill:theme.soft });
  mergeAndSet(sheet, 'B4:D4', `เลขประจำตัวผู้เสียภาษี ${String(settings.shop_tax_id || '-')}`, { size:14, fill:theme.soft, numberFormat:'@' });
  mergeAndSet(sheet, 'B5:D5', `โทร/ไอดีไลน์ ${contactNumber}`, { size:13, fill:theme.soft });
  borderRange(sheet, 'B1:D5', theme.border);

  mergeAndSet(sheet, 'E1:F2', DOC_LABELS[doc.document_type] || doc.document_type, { size:20, bold:true, align:'center', color:'FFFFFF', fill:theme.strong });
  setValue(sheet.getCell('E3'), 'เลขที่', { bold:true, align:'right', fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F3'), String(doc.document_number || ''), { bold:true, align:'center', fill:theme.soft2, numberFormat:'@' });
  setValue(sheet.getCell('E4'), 'วันที่', { bold:true, align:'right', fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F4'), dateThai(doc.document_date), { align:'center', fill:theme.soft2 });
  setValue(sheet.getCell('E5'), 'ครบกำหนด', { bold:true, align:'right', fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F5'), doc.due_date ? dateThai(doc.due_date) : '-', { align:'center', fill:theme.soft2 });
  borderRange(sheet, 'E1:F5', theme.border);

  mergeAndSet(sheet, 'A7:F7', 'ข้อมูลลูกค้า / Customer information', { bold:true, color:'FFFFFF', fill:theme.strong });
  setValue(sheet.getCell('A8'), 'นามลูกค้า', { bold:true, fill:theme.soft2, color:theme.strong });
  mergeAndSet(sheet, 'B8:D8', customer.name || '', { fill:theme.soft2 });
  setValue(sheet.getCell('E8'), 'เลขผู้เสียภาษี', { bold:true, fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F8'), String(customer.tax_id || '-'), { fill:theme.soft2, numberFormat:'@' });
  setValue(sheet.getCell('A9'), 'ที่อยู่', { bold:true, fill:theme.soft2, color:theme.strong });
  mergeAndSet(sheet, 'B9:D9', customer.address || '-', { fill:theme.soft2 });
  setValue(sheet.getCell('E9'), 'โทร', { bold:true, fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F9'), String(customer.phone || '-'), { fill:theme.soft2, numberFormat:'@' });
  setValue(sheet.getCell('A10'), 'อีเมล', { bold:true, fill:theme.soft2, color:theme.strong });
  mergeAndSet(sheet, 'B10:D10', customer.email || '-', { fill:theme.soft2 });
  setValue(sheet.getCell('E10'), 'สาขา', { bold:true, fill:theme.soft2, color:theme.strong });
  setValue(sheet.getCell('F10'), customer.branch_name || '-', { fill:theme.soft2 });
  sheet.getRow(9).height = 32;
  sheet.getRow(11).height = 7;
  borderRange(sheet, 'A7:F10', theme.border);

  const tableHeaderRow = 12;
  const headers = ['ลำดับ', 'รายการ', 'จำนวน', 'หน่วย', 'ราคา/หน่วย', 'จำนวนเงิน'];
  headers.forEach((header, index) => setValue(sheet.getCell(tableHeaderRow, index + 1), header, {
    bold:true, align:'center', color:'FFFFFF', fill:theme.strong
  }));
  sheet.getRow(tableHeaderRow).height = 25;
  borderRange(sheet, `A${tableHeaderRow}:F${tableHeaderRow}`, theme.border);

  const firstItemRow = tableHeaderRow + 1;
  const itemRows = Math.max(displayItems.length, MIN_ITEM_ROWS);
  let itemSequence = 0;
  for (let index = 0; index < itemRows; index += 1) {
    const rowNumber = firstItemRow + index;
    const row = sheet.getRow(rowNumber);
    const item = displayItems[index];
    row.height = 22;

    if (item?.line_type === 'section' || item?.line_type === 'note') {
      mergeAndSet(sheet, `B${rowNumber}:F${rowNumber}`, item.description || '', {
        bold:item.line_type === 'section',
        color:item.text_style === 'warning' ? '9F1239' : theme.strong,
        fill:item.line_type === 'section' ? theme.soft : (item.text_style === 'warning' ? 'FFF1F2' : theme.soft2)
      });
      setValue(sheet.getCell(rowNumber, 1), '', { fill:item.line_type === 'section' ? theme.soft : theme.soft2 });
      row.height = Math.max(24, 18 + Math.ceil(String(item.description || '').length / 75) * 12);
    } else {
      if (item) itemSequence += 1;
      const quantity = item ? numeric(item.quantity) : 0;
      const price = item ? numeric(item.unit_price) : 0;
      const amount = item ? numeric(item.line_total || (quantity * price)) : 0;
      formulaCell(sheet.getCell(rowNumber, 1), `IF(B${rowNumber}="","",COUNT($C$${firstItemRow}:C${rowNumber}))`, item ? itemSequence : '', { align:'center' });
      setValue(sheet.getCell(rowNumber, 2), item?.description || '', {});
      setValue(sheet.getCell(rowNumber, 3), item ? quantity : '', { align:'center', numberFormat:'#,##0.##' });
      setValue(sheet.getCell(rowNumber, 4), item?.unit || '', { align:'center' });
      setValue(sheet.getCell(rowNumber, 5), item ? price : '', { align:'right', numberFormat:CURRENCY_FORMAT });
      formulaCell(sheet.getCell(rowNumber, 6), `IF(OR(C${rowNumber}="",E${rowNumber}=""),"",C${rowNumber}*E${rowNumber})`, item ? amount : '', { numberFormat:CURRENCY_FORMAT });
    }
    borderRange(sheet, `A${rowNumber}:F${rowNumber}`, 'B7C0CC');
  }

  const lastItemRow = firstItemRow + itemRows - 1;
  const isRC = doc.document_type === 'RC';
  let summaryRow = lastItemRow + 1;
  const subtotalRow = summaryRow;

  // Build right-side summary rows
  setValue(sheet.getCell(summaryRow, 5), 'รวมเป็นเงิน', { bold:true, align:'right', fill:theme.soft2, color:theme.strong });
  formulaCell(sheet.getCell(summaryRow, 6), `SUM(F${firstItemRow}:F${lastItemRow})`, displaySubtotal, { bold:true, fill:theme.soft2, numberFormat:CURRENCY_FORMAT });

  let discountRow = null;
  if (displayDiscount > 0) {
    summaryRow += 1;
    discountRow = summaryRow;
    setValue(sheet.getCell(summaryRow, 5), 'ส่วนลด', { align:'right', fill:theme.soft2 });
    setValue(sheet.getCell(summaryRow, 6), displayDiscount, { align:'right', fill:theme.soft2, numberFormat:CURRENCY_FORMAT });
  }

  let paidBeforeRow = null;
  if (usesSourceDetails && numeric(doc.payment_summary?.paid_before) > 0) {
    summaryRow += 1;
    paidBeforeRow = summaryRow;
    setValue(sheet.getCell(summaryRow, 5), 'ชำระก่อนหน้านี้', { align:'right', fill:theme.soft2 });
    setValue(sheet.getCell(summaryRow, 6), numeric(doc.payment_summary.paid_before), { align:'right', fill:theme.soft2, numberFormat:CURRENCY_FORMAT });
  }

  let withholdingRow = null;
  if (numeric(doc.withholding_amount) > 0) {
    summaryRow += 1;
    withholdingRow = summaryRow;
    setValue(sheet.getCell(summaryRow, 5), `หัก ณ ที่จ่าย ${numeric(doc.withholding_rate)}%`, { align:'right', fill:theme.soft2 });
    setValue(sheet.getCell(summaryRow, 6), numeric(doc.withholding_amount), { align:'right', fill:theme.soft2, numberFormat:CURRENCY_FORMAT });
  }

  let transferFeeRow = null;
  if (numeric(doc.transfer_fee) > 0) {
    summaryRow += 1;
    transferFeeRow = summaryRow;
    setValue(sheet.getCell(summaryRow, 5), 'ค่าธรรมเนียมโอน', { align:'right', fill:theme.soft2 });
    setValue(sheet.getCell(summaryRow, 6), numeric(doc.transfer_fee), { align:'right', fill:theme.soft2, numberFormat:CURRENCY_FORMAT });
  }

  summaryRow += 1;
  const netRow = summaryRow;
  setValue(sheet.getCell(summaryRow, 5), usesSourceDetails ? receiptAmountLabel(doc) : documentSummaryLabel(doc), { bold:true, align:'right', fill:theme.strong, color:'FFFFFF', size:14 });
  setValue(sheet.getCell(summaryRow, 6), isRC ? numeric(doc.grand_total) : displayGrandTotal, { bold:true, fill:theme.strong, color:'FFFFFF', size:14, numberFormat:CURRENCY_FORMAT });

  let remainingRow = null;
  if (usesSourceDetails) {
    summaryRow += 1;
    remainingRow = summaryRow;
    setValue(sheet.getCell(summaryRow, 5), 'ยอดคงเหลือ', { bold:true, align:'right', fill:theme.soft2, color:theme.strong });
    setValue(sheet.getCell(summaryRow, 6), numeric(doc.payment_summary.remaining_after), { bold:true, align:'right', fill:theme.soft2, numberFormat:CURRENCY_FORMAT });
  }

  const summaryEndRow = summaryRow;

  // Build left-side content merged across A{subtotalRow}:D{summaryEndRow}
  const paymentTypeLabels = { DEPOSIT:'มัดจำ', PARTIAL:'ชำระบางส่วน', INSTALLMENT:'ชำระตามงวด', FULL:'ชำระครบทั้งหมด' };
  const paymentMethodLabels = { CASH:'เงินสด', TRANSFER:'โอนเข้าบัญชี', CHECK:'เช็ค', OTHER:'อื่น ๆ' };
  const paymentType = doc.receipt_payment_type || (doc.installment_number ? 'INSTALLMENT' : 'FULL');
  const paymentMethod = doc.receipt_payment_method || 'TRANSFER';

  let leftText = `(${thaiBahtText(doc.net_total)})`;
  if (isRC) {
    const details = [];
    if (doc.payment_summary?.source_number) details.push(`อ้างอิง: ${doc.payment_summary.source_number}`);
    details.push(`ช่องทาง: ${paymentMethodLabels[paymentMethod] || 'โอนเข้าบัญชี'} (${paymentTypeLabels[paymentType] || 'รับชำระ'})`);
    details.push(`วันที่รับชำระ: ${dateThai(doc.payment_received_date || doc.document_date)}`);
    if (doc.installment_number && doc.installment_count) details.push(`งวดที่: ${numeric(doc.installment_number)}/${numeric(doc.installment_count)}`);
    if (doc.withholding_certificate_number) details.push(`หนังสือหัก ณ ที่จ่าย: ${doc.withholding_certificate_number}`);
    leftText += `\n` + details.join('\n');
  }

  mergeAndSet(sheet, `A${subtotalRow}:D${summaryEndRow}`, leftText, { bold:isRC, align:'left', fill:theme.soft2, color:theme.strong, size:13 });
  borderRange(sheet, `A${subtotalRow}:F${summaryEndRow}`, theme.border);

  sheet.getRow(summaryEndRow + 1).height = 7;
  let contentRow = summaryEndRow + 2;

  const terms = [];
  if (doc.remarks) terms.push(`หมายเหตุ: ${doc.remarks}`);
  if (doc.payment_terms) terms.push(`เงื่อนไขการชำระ: ${doc.payment_terms}`);
  if (doc.delivery_days != null) terms.push(`กำหนดส่งงานภายใน ${doc.delivery_days} วัน`);
  if (doc.document_type === 'QT' && doc.quotation_validity_days != null) terms.push(`ราคานี้ยืนได้ ${doc.quotation_validity_days} วัน`);
  if (terms.length) {
    mergeAndSet(sheet, `A${contentRow}:F${contentRow}`, `หมายเหตุ / เงื่อนไข\n${terms.join('\n')}`, { fill:theme.soft2, color:theme.strong });
    sheet.getRow(contentRow).height = Math.max(38, 18 + terms.length * 15);
    borderRange(sheet, `A${contentRow}:F${contentRow}`, theme.border);
    sheet.getRow(contentRow + 1).height = 7;
    contentRow += 2;
  }

  if (['IN', 'BN'].includes(doc.document_type)) {
    const customerType = customer.customer_type;
    const bank = customerType === 'private'
      ? settings.scb_bank_details
      : customerType === 'government' ? settings.ktb_bank_details : '';
    if (bank) {
      const bankLines = String(bank).split('\n').length;
      mergeAndSet(sheet, `A${contentRow}:F${contentRow}`, `รายละเอียดการชำระเงิน\n${bank}`, { fill:theme.soft2, color:theme.strong });
      sheet.getRow(contentRow).height = Math.max(38, 18 + bankLines * 15);
      borderRange(sheet, `A${contentRow}:F${contentRow}`, theme.border);
      sheet.getRow(contentRow + 1).height = 7;
      contentRow += 2;
    }
  }

  const signatureStart = contentRow;
  const signatureEnd = contentRow + 3;
  signatureLayout(doc.document_type).forEach((box) => {
    const [startColumn, endColumn] = box.range.split(':');
    mergeAndSet(sheet, `${startColumn}${signatureStart}:${endColumn}${signatureStart}`, box.title, { bold:true, align:'center', color:theme.strong, fill:theme.soft2 });
    const detail = box.detail || `ลงชื่อ ........................................\n${settings.shop_owner || doc.created_by_name || ''}`;
    mergeAndSet(sheet, `${startColumn}${signatureStart + 1}:${endColumn}${signatureEnd}`, detail, { align:'center', fill:'FFFFFF' });
    borderRange(sheet, `${startColumn}${signatureStart}:${endColumn}${signatureEnd}`, theme.border);
    if (box.issuer && signature) {
      addImageToSheet(workbook, sheet, signature, `${startColumn}${signatureStart + 1}:${endColumn}${signatureStart + 3}`);
    }
  });
  for (let row = signatureStart; row <= signatureEnd; row += 1) sheet.getRow(row).height = row === signatureStart ? 22 : 18;

  const finalRow = signatureEnd;
  sheet.pageSetup.printArea = `A1:F${finalRow}`;
  sheet.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;
  sheet.pageSetup.blackAndWhite = Boolean(options.monochrome);
  sheet.autoFilter = null;

  return workbook;
}

export async function downloadExcelDocument(doc, options = {}) {
  const workbook = await buildExcelWorkbook(doc, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(doc.document_number)}-${safeFilename(DOC_LABELS[doc.document_type])}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
