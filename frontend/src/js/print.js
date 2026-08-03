import { request, getToken } from './api.js';
import { DOC_LABELS, number, dateThai, escapeHtml, thaiBahtText } from './utils.js';
import { downloadExcelDocument } from './excel-export.js';

if (!getToken()) location.replace('./index.html');
const id = new URLSearchParams(location.search).get('id');
const root = document.getElementById('print-document');
const pageCount = document.getElementById('page-count');
const pageWarning = document.getElementById('page-warning');
const printModeSelect = document.getElementById('print-mode-select');
const printButton = document.getElementById('print-button');
const excelButton = document.getElementById('excel-button');
let currentDocument = null;

function statusWatermark(doc) {
  const map = { DRAFT: 'ฉบับร่าง', CANCELLED: 'ยกเลิก', PAID: 'ชำระแล้ว', REJECTED: 'ไม่อนุมัติ' };
  return map[doc.status] ? `<div class="print-watermark">${escapeHtml(map[doc.status])}</div>` : '';
}

const savedPrintMode = localStorage.getItem('tong_billing_print_mode') || 'color';
printModeSelect.value = savedPrintMode === 'mono' ? 'mono' : 'color';
function applyPrintMode(mode) {
  const nextMode = mode === 'mono' ? 'mono' : 'color';
  document.body.classList.toggle('print-monochrome', nextMode === 'mono');
  localStorage.setItem('tong_billing_print_mode', nextMode);
}
applyPrintMode(printModeSelect.value);
printModeSelect.addEventListener('change', (event) => applyPrintMode(event.currentTarget.value));
printButton.addEventListener('click', () => window.print());
excelButton.addEventListener('click', async () => {
  if (!currentDocument || !window.ExcelJS) return alert('ยังโหลดข้อมูลสำหรับส่งออกไม่สำเร็จ');
  const originalText = excelButton.textContent;
  excelButton.disabled = true;
  excelButton.textContent = 'กำลังสร้าง Excel…';
  try {
    await downloadExcelDocument(currentDocument, {
      ExcelJS:window.ExcelJS,
      monochrome:document.body.classList.contains('print-monochrome')
    });
  } catch (error) {
    alert(`สร้างไฟล์ Excel ไม่สำเร็จ: ${error.message}`);
  } finally {
    excelButton.disabled = false;
    excelButton.textContent = originalText;
  }
});

function summaryRows(doc) {
  const rows = [['รวมเป็นเงิน', doc.subtotal]];
  if (Number(doc.discount) > 0) rows.push(['ส่วนลด', `-${number(doc.discount)}`]);
  if (doc.document_type === 'RC' && Number(doc.withholding_amount) > 0) {
    rows.push([`หัก ณ ที่จ่ายจริง ${Number(doc.withholding_rate)}%`, `-${number(doc.withholding_amount)}`]);
  }
  if (Number(doc.transfer_fee) > 0) rows.push(['ค่าธรรมเนียมโอน', `-${number(doc.transfer_fee)}`]);
  rows.push([
    doc.document_type === 'RC' ? 'จำนวนเงินที่ได้รับจริง'
      : doc.document_type === 'BN' ? 'ยอดรวมใบวางบิล'
        : doc.document_type === 'IN' ? 'ยอดรวมใบแจ้งหนี้' : 'รวมสุทธิ',
    doc.net_total
  ]);
  return rows.map(([label, value], index) => `
    <tr class="${index === rows.length - 1 ? 'net-row' : ''}">
      ${index === 0 ? `<td colspan="4" rowspan="${rows.length}" class="baht-text-cell">${thaiBahtText(doc.net_total)}</td>` : ''}
      <th class="summary-label">${escapeHtml(label)}</th>
      <td class="summary-value">${typeof value === 'string' && value.startsWith('-') ? value : number(value)}</td>
    </tr>`).join('');
}

function paymentBox(doc) {
  if (!['IN', 'BN'].includes(doc.document_type)) return '';
  const type = doc.customer_snapshot.customer_type;
  const bank = type === 'private' ? doc.settings.scb_bank_details : type === 'government' ? doc.settings.ktb_bank_details : '';
  return bank ? `<section class="payment-box"><strong>รายละเอียดการชำระเงิน</strong><div>${escapeHtml(bank).replaceAll('\n', '<br>')}</div></section>` : '';
}

function receiptPaymentDetails(doc) {
  if (doc.document_type !== 'RC') return '';
  const rows = [`<div><strong>วันที่รับเงินจริง:</strong> ${dateThai(doc.payment_received_date || doc.document_date)}</div>`];
  if (doc.withholding_certificate_number) rows.push(`<div><strong>เลขที่หนังสือรับรองหัก ณ ที่จ่าย:</strong> ${escapeHtml(doc.withholding_certificate_number)}</div>`);
  if (doc.withholding_certificate_date) rows.push(`<div><strong>วันที่หนังสือรับรอง:</strong> ${dateThai(doc.withholding_certificate_date)}</div>`);
  return `<section class="payment-box"><strong>ข้อมูลการรับชำระ</strong>${rows.join('')}</section>`;
}

function signatures(doc) {
  const snapshot = doc.signatures?.find((item) => item.role === 'issuer')?.signature_url;
  const source = doc.show_signature ? (snapshot || doc.settings.saved_signature_url) : '';
  const signature = source
    ? `<img class="signature-image" src="${escapeHtml(source)}" alt="ลายเซ็น" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
    : '<div class="signature-placeholder"></div>';
  const date = dateThai(doc.document_date);
  if (doc.document_type === 'BN') return `<section class="signature-grid"><div class="signature-box"><strong>ผู้รับใบวางบิล / Recipient</strong><div>ลงชื่อ........................................<br>วันที่........................................</div></div><div class="signature-box"><strong>ผู้ออกใบวางบิล</strong>${signature}<div>ลงชื่อ........................................<br>วันที่ ${date}</div></div></section>`;
  if (doc.document_type === 'DO') return `<section class="signature-grid"><div class="signature-box"><strong>ผู้รับของ / Receiver</strong><span>ได้รับสินค้าตามรายการถูกต้องแล้ว</span><div>ลงชื่อ........................................<br>วันที่........................................</div></div><div class="signature-box"><strong>ผู้ส่งของ / Delivered By</strong>${signature}<div>ลงชื่อ........................................<br>วันที่ ${date}</div></div></section>`;
  const label = doc.document_type === 'QT' ? 'ผู้เสนอราคา' : doc.document_type === 'RC' ? 'ผู้รับเงิน' : 'ผู้จัดทำเอกสาร';
  return `<section class="signature-grid" style="grid-template-columns:1fr;max-width:50%;margin-left:auto"><div class="signature-box"><strong>${label}</strong>${signature}<div>ลงชื่อ........................................<br>${escapeHtml(doc.settings.shop_owner || doc.created_by_name || '')}<br>วันที่ ${date}</div></div></section>`;
}

function rowUnits(item) {
  if (item.line_type === 'section') return 1.2;
  if (item.line_type === 'note') return Math.max(1.2, Math.ceil(String(item.description || '').length / 80));
  return Math.max(1, Math.ceil(String(item.description || '').length / 72));
}

// Keeps the exact same page groups for on-screen preview, browser printing and PDF.
function paginateItems(items) {
  const pages = [];
  let page = [];
  let used = 0;
  items.forEach((item) => {
    const units = rowUnits(item);
    const firstPageCapacity = 18;
    const continuationCapacity = 27;
    const capacity = pages.length === 0 ? firstPageCapacity : continuationCapacity;
    if (page.length && used + units > capacity) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += units;
  });
  if (page.length || !pages.length) pages.push(page);

  // Reserve the last page for totals, conditions, payment details and signatures.
  const footerUnits = 11;
  const lastCapacity = pages.length === 1 ? 18 : 27;
  const lastUnits = pages.at(-1).reduce((sum, item) => sum + rowUnits(item), 0);
  if (pages.at(-1).length > 1 && lastUnits + footerUnits > lastCapacity) {
    const carry = [];
    let remaining = lastUnits;
    while (pages.at(-1).length > 1 && remaining + footerUnits > lastCapacity) {
      const moved = pages.at(-1).pop();
      carry.unshift(moved);
      remaining -= rowUnits(moved);
    }
    pages.push(carry);
  }
  return pages;
}

function itemRows(items, startSequence) {
  let sequence = startSequence;
  const html = items.map((item) => {
    if (item.line_type === 'section') return `<tr class="section-row"><td></td><td colspan="5">${escapeHtml(item.description)}</td></tr>`;
    if (item.line_type === 'note') return `<tr class="note-row ${item.text_style === 'warning' ? 'warning-row' : ''}"><td></td><td colspan="5">${escapeHtml(item.description)}</td></tr>`;
    sequence += 1;
    return `<tr><td class="center">${sequence}</td><td>${escapeHtml(item.description)}</td><td class="center">${number(item.quantity).replace('.00', '')}</td><td class="center">${escapeHtml(item.unit || '')}</td><td class="number">${number(item.unit_price)}</td><td class="number">${number(item.line_total)}</td></tr>`;
  }).join('');
  return { html, sequence };
}

function header(doc, pageNumber) {
  if (pageNumber > 1) return `<header class="continued-title"><strong>${DOC_LABELS[doc.document_type]} (ต่อ)</strong><span>${escapeHtml(doc.document_number)}</span></header>`;
  return `<header class="doc-header">
    <img class="doc-logo" src="${escapeHtml(doc.settings.logo_url || './assets/logo-placeholder.svg')}" alt="โลโก้" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='./assets/logo-placeholder.svg'">
    <div class="shop-info"><h1>${escapeHtml(doc.settings.shop_name_th)}</h1><p>${escapeHtml(doc.settings.shop_name_en)}</p><p>${escapeHtml(doc.settings.shop_address || '')}</p><p>เลขผู้เสียภาษี ${escapeHtml(doc.settings.shop_tax_id || '-')} · โทร ${escapeHtml(doc.settings.shop_phone || '-')}</p><p>${escapeHtml(doc.settings.shop_email || '')}</p></div>
    <div class="doc-title"><h2>${DOC_LABELS[doc.document_type]}</h2><strong>เลขที่ ${escapeHtml(doc.document_number)}</strong><span>วันที่ ${dateThai(doc.document_date)}</span></div>
  </header>`;
}

function customerBlock(doc) {
  const customer = doc.customer_snapshot;
  return `<section class="customer-grid">
    <div class="box"><strong>นามลูกค้า / Name</strong><p>${escapeHtml(customer.name)}</p><strong>ที่อยู่ / Address</strong><p>${escapeHtml(customer.address || '-')}</p></div>
    <div class="box"><p><strong>เลขผู้เสียภาษี:</strong> ${escapeHtml(customer.tax_id || '-')}</p><p><strong>โทร:</strong> ${escapeHtml(customer.phone || '-')}</p><p><strong>ครบกำหนด:</strong> ${doc.due_date ? dateThai(doc.due_date) : '-'}</p></div>
  </section>`;
}

function table(rows, footer = '') {
  return `<table class="doc-table"><colgroup><col class="col-index"><col class="col-description"><col class="col-quantity"><col class="col-unit"><col class="col-price"><col class="col-amount"></colgroup>
    <thead><tr><th>ลำดับ</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคา/หน่วย</th><th>จำนวนเงิน</th></tr></thead>
    <tbody>${rows}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table>`;
}

function finalBlocks(doc) {
  const hasTerms = doc.remarks || doc.payment_terms || doc.delivery_days != null || doc.quotation_validity_days != null;
  const terms = hasTerms ? `<section class="terms"><strong>หมายเหตุ / เงื่อนไข</strong>${doc.remarks ? `<div>${escapeHtml(doc.remarks).replaceAll('\n', '<br>')}</div>` : ''}${doc.payment_terms ? `<div>เงื่อนไขการชำระ: ${escapeHtml(doc.payment_terms)}</div>` : ''}${doc.delivery_days != null ? `<div>กำหนดส่งงานภายใน ${doc.delivery_days} วัน</div>` : ''}${doc.quotation_validity_days != null ? `<div>ราคานี้ยืนได้ ${doc.quotation_validity_days} วัน</div>` : ''}</section>` : '';
  return `${terms}${paymentBox(doc)}${receiptPaymentDetails(doc)}${signatures(doc)}`;
}

function renderPages(doc) {
  const groups = paginateItems(doc.items);
  const totalPages = groups.length;
  let sequence = 0;
  root.dataset.documentType = doc.document_type;
  root.innerHTML = groups.map((items, index) => {
    const pageNumber = index + 1;
    const isLast = pageNumber === groups.length;
    const rendered = itemRows(items, sequence);
    sequence = rendered.sequence;
    return `<section class="a4-sheet" data-document-type="${doc.document_type}">
      ${statusWatermark(doc)}${header(doc, pageNumber)}${pageNumber === 1 ? customerBlock(doc) : ''}
      ${table(rendered.html, isLast ? summaryRows(doc) : '')}
      ${isLast ? finalBlocks(doc) : ''}
      <div class="page-number">หน้า ${pageNumber}/${totalPages}</div>
    </section>`;
  }).join('');
  pageCount.textContent = `ตัวอย่าง A4: ${totalPages} หน้า`;
  pageWarning.classList.toggle('hidden', totalPages === 1);
  pageWarning.innerHTML = totalPages > 1
    ? `เอกสารนี้มี <strong>${doc.items.length} รายการ</strong> และใช้กระดาษ A4 จำนวน <strong>${totalPages} หน้า</strong> ระบบแบ่งหน้าให้อัตโนมัติโดยไม่ลบข้อมูล หากต้องการหน้าเดียว กรุณากลับไปรวบรายการ หรือส่งออก Excel เพื่อจัดรูปแบบสำเนาเอง`
    : '';
}

async function render() {
  if (!id) throw new Error('ไม่พบรหัสเอกสาร');
  const { data: doc } = await request(`/documents/${id}`);
  currentDocument = doc;
  document.title = `${doc.document_number} | ${DOC_LABELS[doc.document_type]}`;
  renderPages(doc);
}

render().catch((error) => {
  root.innerHTML = `<section class="a4-sheet"><p style="color:#b91c1c">${escapeHtml(error.message)}</p></section>`;
  pageCount.textContent = 'โหลดเอกสารไม่สำเร็จ';
});
