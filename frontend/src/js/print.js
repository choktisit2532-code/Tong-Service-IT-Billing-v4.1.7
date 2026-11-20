import { request, getToken } from './api.js';
import { DOC_LABELS, number, dateThai, escapeHtml, thaiBahtText } from './utils.js';
import { downloadExcelDocument } from './excel-export.js';

if (!getToken()) location.replace('./index.html');
const id = new URLSearchParams(location.search).get('id');
const root = document.getElementById('print-document');
const pageCount = document.getElementById('page-count');
const pageWarning = document.getElementById('page-warning');
const printModeSelect = document.getElementById('print-mode-select');
const printDateSelect = document.getElementById('print-date-select');
const printButton = document.getElementById('print-button');
const excelButton = document.getElementById('excel-button');
const attachPanel = document.getElementById('attach-panel');
let currentDocument = null;

// ============================================================
// Attachment (เอกสารแนบ) state
// ============================================================
const ATTACH_WARN_DAYS_PRINT = 30;
let attachMeta = null; // metadata จาก /settings/attachments/meta

function daysUntilExpiry(expiryStr) {
  if (!expiryStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(expiryStr); exp.setHours(0,0,0,0);
  return Math.round((exp - today) / 86400000);
}

/** โหลด attachment metadata (ไม่โหลด PDF ใหญ่) */
async function loadAttachMeta() {
  try {
    const res = await request('/settings/attachments/meta');
    attachMeta = res.data;
    setupAttachPanel();
  } catch { /* silent — ใช้งานได้แม้ไม่มี attachment */ }
}

/** ตั้งค่า checkbox panel และ auto-check ตามประเภทลูกค้า */
function setupAttachPanel() {
  if (!currentDocument || currentDocument.document_type !== 'QT' || !attachPanel) return;
  attachPanel.classList.remove('hidden');

  const isGov = currentDocument.customer_type === 'government';
  const cbTypes = ['id-card', 'commercial-reg', 'sme-gp'];

  cbTypes.forEach((type) => {
    const cb      = document.getElementById(`attach-cb-${type}`);
    const warn    = document.getElementById(`attach-warn-${type}`);
    const lbl     = document.getElementById(`attach-label-${type}`);
    if (!cb) return;

    // ตรวจสอบว่ามีไฟล์ใน DB ไหม
    const hasFile = type === 'id-card'       ? attachMeta?.has_id_card
                  : type === 'commercial-reg' ? attachMeta?.has_commercial_reg
                  : attachMeta?.has_sme_gp;

    if (!hasFile) {
      cb.disabled = true;
      lbl.title = 'ยังไม่มีไฟล์ — กรุณาอัปโหลดในหน้าตั้งค่าระบบ';
      lbl.style.opacity = '0.5';
      return;
    }

    // แจ้งเตือนหมดอายุ
    const expiryStr = type === 'id-card' ? attachMeta?.attach_id_card_expiry
                    : type === 'sme-gp'  ? attachMeta?.attach_sme_gp_expiry
                    : null;
    if (warn && expiryStr) {
      const days = daysUntilExpiry(expiryStr);
      if (days !== null && days < 0) {
        warn.classList.remove('hidden');
        warn.title = `หมดอายุแล้ว ${Math.abs(days)} วันที่ผ่านมา`;
      } else if (days !== null && days <= ATTACH_WARN_DAYS_PRINT) {
        warn.classList.remove('hidden');
        warn.textContent = `⚠️ เหลือ ${days} วัน`;
        warn.title = `ใกล้หมดอายุ`;
      }
    }

    // auto-check สำหรับราชการ
    cb.checked = isGov;

    // เมื่อเปลี่ยน checkbox → re-render หน้าแนบเอกสาร
    cb.addEventListener('change', () => renderAttachPages());
  });

  // render หน้าแนบทันที (กรณีราชการ)
  if (isGov) renderAttachPages();
}

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

const savedDateMode = localStorage.getItem('tong_billing_print_date_mode') || 'show';
if (printDateSelect) {
  printDateSelect.value = ['show', 'hide', 'dots'].includes(savedDateMode) ? savedDateMode : 'show';
  printDateSelect.addEventListener('change', (event) => {
    localStorage.setItem('tong_billing_print_date_mode', event.currentTarget.value);
    if (currentDocument) renderPages(currentDocument);
  });
}

printButton.addEventListener('click', () => window.print());
excelButton.addEventListener('click', async () => {
  if (!currentDocument || !window.ExcelJS) return alert('ยังโหลดข้อมูลสำหรับส่งออกไม่สำเร็จ');
  const originalText = excelButton.textContent;
  excelButton.disabled = true;
  excelButton.textContent = 'กำลังสร้าง Excel…';
  try {
    await downloadExcelDocument(currentDocument, {
      ExcelJS:window.ExcelJS,
      monochrome:document.body.classList.contains('print-monochrome'),
      dateMode:printDateSelect ? printDateSelect.value : 'show'
    });
  } catch (error) {
    alert(`สร้างไฟล์ Excel ไม่สำเร็จ: ${error.message}`);
  } finally {
    excelButton.disabled = false;
    excelButton.textContent = originalText;
  }
});

const editDocButton = document.getElementById('edit-doc-button');
if (editDocButton) {
  editDocButton.addEventListener('click', () => {
    if (!currentDocument?.id) return;
    if (window.opener && !window.opener.closed && typeof window.opener.openDocumentModal === 'function') {
      window.opener.openDocumentModal(currentDocument.id).catch(console.error);
      window.opener.focus();
    } else {
      window.location.href = `./app.html?edit=${currentDocument.id}`;
    }
  });
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

function shouldShowReceiptBalance(doc) {
  if (!doc.payment_summary) return false;
  const remaining = Number(doc.payment_summary.remaining_after || 0);
  const paymentType = doc.receipt_payment_type || (doc.installment_number ? 'INSTALLMENT' : 'FULL');
  return remaining > 0.005 || paymentType !== 'FULL' || Boolean(doc.installment_number || doc.installment_count);
}

function summaryRows(doc, dateMode = 'show') {
  const isRC = doc.document_type === 'RC';
  const usesSourceDetails = isRC && doc.payment_summary && doc.receipt_source_items?.length;
  const subtotal = usesSourceDetails ? doc.payment_summary.source_subtotal : doc.subtotal;
  const discount = usesSourceDetails ? doc.payment_summary.source_discount : doc.discount;

  const rows = [['รวมเป็นเงิน', subtotal]];
  if (Number(discount) > 0) rows.push(['ส่วนลด', `-${number(discount)}`]);

  if (usesSourceDetails) {
    if (Number(doc.payment_summary.paid_before) > 0) {
      rows.push(['ชำระก่อนหน้านี้', doc.payment_summary.paid_before]);
    }
    rows.push([receiptAmountLabel(doc), doc.grand_total]);
    if (Number(doc.withholding_amount) > 0) {
      rows.push([`หัก ณ ที่จ่าย ${Number(doc.withholding_rate)}%`, `-${number(doc.withholding_amount)}`]);
    }
    if (Number(doc.transfer_fee) > 0) {
      rows.push(['ค่าธรรมเนียมโอน', `-${number(doc.transfer_fee)}`]);
    }
    if (Number(doc.withholding_amount) > 0 || Number(doc.transfer_fee) > 0) {
      rows.push(['ยอดรับสุทธิ', doc.net_total]);
    }
    if (shouldShowReceiptBalance(doc)) {
      rows.push(['ยอดคงเหลือหลังรับชำระ', doc.payment_summary.remaining_after]);
    }
  } else if (isRC && Number(doc.withholding_amount) > 0) {
    rows.push([`หัก ณ ที่จ่าย ${Number(doc.withholding_rate)}%`, `-${number(doc.withholding_amount)}`]);
  }

  if (!usesSourceDetails && Number(doc.transfer_fee) > 0) {
    rows.push(['ค่าธรรมเนียมโอน', `-${number(doc.transfer_fee)}`]);
  }

  if (!usesSourceDetails) {
    rows.push([
      isRC
        ? (Number(doc.withholding_amount) > 0 || Number(doc.transfer_fee) > 0 ? 'ยอดรับสุทธิ' : receiptAmountLabel(doc))
        : doc.document_type === 'BN' ? 'ยอดรวมใบวางบิล'
          : doc.document_type === 'IN' ? 'ยอดรวมใบแจ้งหนี้' : 'รวมสุทธิ',
      doc.net_total
    ]);
  }

  const rcBahtAmount = (isRC && doc.payment_summary && Number(doc.payment_summary.remaining_after) > 0)
    ? doc.payment_summary.remaining_after
    : doc.net_total;

  const leftCellContent = isRC
    ? `<div class="rc-summary-left">
        ${receiptPaymentDetails(doc, dateMode)}
        <div class="baht-text-main">(${thaiBahtText(rcBahtAmount)})</div>
       </div>`
    : `(${thaiBahtText(doc.net_total)})`;

  return rows.map(([label, value], index) => `
    <tr class="${index === rows.length - 1 ? 'net-row' : ''}">
      ${index === 0 ? `<td colspan="4" rowspan="${rows.length}" class="baht-text-cell ${isRC ? 'baht-text-cell-rc' : ''}">${leftCellContent}</td>` : ''}
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

function receiptPaymentDetails(doc, dateMode = 'show') {
  if (doc.document_type !== 'RC') return '';
  const paymentTypeLabels = {
    DEPOSIT: 'มัดจำ',
    PARTIAL: 'ชำระบางส่วน',
    INSTALLMENT: 'ชำระตามงวด',
    FULL: 'ชำระครบทั้งหมด'
  };
  const paymentMethodLabels = { CASH:'เงินสด', TRANSFER:'โอนเข้าบัญชี', CHECK:'เช็ค', OTHER:'อื่น ๆ' };
  const paymentType = doc.receipt_payment_type || (doc.installment_number ? 'INSTALLMENT' : 'FULL');
  const paymentMethod = doc.receipt_payment_method || 'TRANSFER';

  const details = [];
  if (doc.payment_summary?.source_number) {
    details.push(`<div><strong>อ้างอิง:</strong> ${escapeHtml(doc.payment_summary.source_number)}</div>`);
  }
  details.push(`<div><strong>ช่องทาง:</strong> ${paymentMethodLabels[paymentMethod] || 'โอนเข้าบัญชี'} (${paymentTypeLabels[paymentType] || 'รับชำระ'})</div>`);
  if (dateMode === 'show') {
    details.push(`<div><strong>วันที่รับชำระ:</strong> ${dateThai(doc.payment_received_date || doc.document_date)}</div>`);
  } else if (dateMode === 'dots') {
    details.push('<div><strong>วันที่รับชำระ:</strong> ........................................</div>');
  }
  if (doc.installment_number && doc.installment_count) {
    details.push(`<div><strong>งวดที่:</strong> ${Number(doc.installment_number)}/${Number(doc.installment_count)}</div>`);
  }
  if (doc.withholding_certificate_number) {
    details.push(`<div><strong>หนังสือหัก ณ ที่จ่าย:</strong> ${escapeHtml(doc.withholding_certificate_number)}</div>`);
  }
  if (doc.withholding_certificate_date) {
    if (dateMode === 'show') {
      details.push(`<div><strong>วันที่หนังสือรับรอง:</strong> ${dateThai(doc.withholding_certificate_date)}</div>`);
    } else if (dateMode === 'dots') {
      details.push('<div><strong>วันที่หนังสือรับรอง:</strong> ........................................</div>');
    }
  }

  return `<div class="rc-payment-info">${details.join('')}</div>`;
}

function signatures(doc) {
  const snapshot = doc.signatures?.find((item) => item.role === 'issuer')?.signature_url;
  const source = doc.show_signature ? (snapshot || doc.settings.saved_signature_url) : '';
  const signature = source
    ? `<img class="signature-image" src="${escapeHtml(source)}" alt="ลายเซ็น" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
    : '<div class="signature-placeholder"></div>';
  if (doc.document_type === 'BN') return `<section class="signature-grid"><div class="signature-box"><strong>ผู้รับใบวางบิล / Recipient</strong><div>ลงชื่อ........................................</div></div><div class="signature-box"><strong>ผู้ออกใบวางบิล</strong>${signature}<div>ลงชื่อ........................................</div></div></section>`;
  if (doc.document_type === 'DO') return `<section class="signature-grid"><div class="signature-box"><strong>ผู้รับของ / Receiver</strong><span>ได้รับสินค้าตามรายการถูกต้องแล้ว</span><div>ลงชื่อ........................................</div></div><div class="signature-box"><strong>ผู้ส่งของ / Delivered By</strong>${signature}<div>ลงชื่อ........................................</div></div></section>`;
  const label = doc.document_type === 'QT' ? 'ผู้เสนอราคา' : doc.document_type === 'RC' ? 'ผู้รับเงิน' : 'ผู้จัดทำเอกสาร';
  return `<section class="signature-grid single-signature"><div class="signature-box"><strong>${label}</strong>${signature}<div>ลงชื่อ........................................<br>${escapeHtml(doc.settings.shop_owner || doc.created_by_name || '')}</div></div></section>`;
}

function rowUnits(item) {
  if (item.line_type === 'section') return 1.2;
  if (item.line_type === 'note') return Math.max(1.2, Math.ceil(String(item.description || '').length / 80));
  const hasMeta = item.serial_number || item.warranty_period;
  return Math.max(hasMeta ? 1.4 : 1, Math.ceil(String(item.description || '').length / 72));
}

function getFooterUnits(doc) {
  if (!doc) return 7;
  if (doc.document_type === 'RC') return 5.5;

  const customerType = doc.customer_snapshot?.customer_type;
  const hasBank = ['IN', 'BN'].includes(doc.document_type) &&
    ((customerType === 'private' && doc.settings?.scb_bank_details) ||
     (customerType === 'government' && doc.settings?.ktb_bank_details));

  const quotationValidity = doc.document_type === 'QT' && doc.quotation_validity_days != null;
  const hasTerms = Boolean(doc.remarks || doc.payment_terms || doc.delivery_days != null || quotationValidity);

  let units = 4.5; // base: tfoot summary + signature grid
  if (hasBank) units += 2.2;
  if (hasTerms) units += 1.5;
  return units;
}

// Keeps the exact same page groups for on-screen preview, browser printing and PDF.
function paginateItems(items, doc) {
  const pages = [];
  let page = [];
  let used = 0;
  items.forEach((item) => {
    const units = rowUnits(item);
    const firstPageCapacity = 19;
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
  const footerUnits = getFooterUnits(doc);
  const lastCapacity = pages.length === 1 ? 19 : 27;
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
    let meta = [];
    if (item.serial_number) meta.push(`S/N: ${escapeHtml(item.serial_number)}`);
    if (item.warranty_period) meta.push(`ประกัน: ${escapeHtml(item.warranty_period)}`);
    const metaHtml = meta.length ? `<div style="font-size:11px;color:#475569;margin-top:2px;font-weight:normal;">[${meta.join(' | ')}]</div>` : '';
    return `<tr><td class="center">${sequence}</td><td>${escapeHtml(item.description)}${metaHtml}</td><td class="center">${number(item.quantity).replace('.00', '')}</td><td class="center">${escapeHtml(item.unit || '')}</td><td class="number">${number(item.unit_price)}</td><td class="number">${number(item.line_total)}</td></tr>`;
  }).join('');
  return { html, sequence };
}

function header(doc, pageNumber, dateMode = 'show') {
  if (pageNumber > 1) return `<header class="continued-title"><strong>${DOC_LABELS[doc.document_type]} (ต่อ)</strong><span>${escapeHtml(doc.document_number)}</span></header>`;
  const shopName = [doc.settings.shop_name_th, doc.settings.shop_name_en].filter(Boolean).join(' ');
  const contactNumber = String(doc.settings.shop_phone || '0864733795').replace(/\D/g, '') || '0864733795';
  let dateHtml = '';
  if (dateMode === 'show') {
    dateHtml = `<span>วันที่ ${dateThai(doc.document_date)}</span>`;
  } else if (dateMode === 'dots') {
    dateHtml = '<span>วันที่ ........................................</span>';
  }
  return `<header class="doc-header">
    <img class="doc-logo" src="${escapeHtml(doc.settings.logo_url || './assets/logo-placeholder.svg')}" alt="โลโก้" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='./assets/logo-placeholder.svg'">
    <div class="shop-info"><h1>${escapeHtml(shopName)}</h1><p>${escapeHtml(doc.settings.shop_address || '')}</p><p>เลขผู้เสียภาษี ${escapeHtml(doc.settings.shop_tax_id || '-')} · โทร/ไอดีไลน์ ${escapeHtml(contactNumber)}</p></div>
    <div class="doc-title"><h2>${DOC_LABELS[doc.document_type]}</h2><strong>เลขที่ ${escapeHtml(doc.document_number)}</strong>${dateHtml}</div>
  </header>`;
}

function customerBlock(doc, dateMode = 'show') {
  const customer = doc.customer_snapshot;
  const showDue = dateMode === 'show' && doc.due_date;
  const dueContent = dateMode === 'hide' ? '-' : (showDue ? dateThai(doc.due_date) : '-');
  return `<section class="customer-grid">
    <div class="box"><strong>นามลูกค้า / Name</strong><p>${escapeHtml(customer.name)}</p><strong>ที่อยู่ / Address</strong><p>${escapeHtml(customer.address || '-')}</p></div>
    <div class="box"><p><strong>เลขผู้เสียภาษี:</strong> ${escapeHtml(customer.tax_id || '-')}</p><p><strong>โทร:</strong> ${escapeHtml(customer.phone || '-')}</p><p><strong>ครบกำหนด:</strong> ${dueContent}</p></div>
  </section>`;
}

function table(rows, footer = '') {
  return `<table class="doc-table"><colgroup><col class="col-index"><col class="col-description"><col class="col-quantity"><col class="col-unit"><col class="col-price"><col class="col-amount"></colgroup>
    <thead><tr><th>ลำดับ</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคา/หน่วย</th><th>จำนวนเงิน</th></tr></thead>
    <tbody>${rows}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table>`;
}

function finalBlocks(doc, dateMode = 'show') {
  // ระยะเวลาราคายืนเป็นเงื่อนไขของใบเสนอราคาเท่านั้น ไม่ส่งต่อไปแสดงในเอกสารปลายทาง
  const quotationValidity = doc.document_type === 'QT' && doc.quotation_validity_days != null
    ? `<div>ราคานี้ยืนได้ ${doc.quotation_validity_days} วัน</div>`
    : '';
  const hasTerms = doc.remarks || doc.payment_terms || doc.delivery_days != null || quotationValidity;
  const terms = hasTerms ? `<section class="terms"><strong>หมายเหตุ / เงื่อนไข</strong>${doc.remarks ? `<div>${escapeHtml(doc.remarks).replaceAll('\n', '<br>')}</div>` : ''}${doc.payment_terms ? `<div>เงื่อนไขการชำระ: ${escapeHtml(doc.payment_terms)}</div>` : ''}${doc.delivery_days != null ? `<div>กำหนดส่งงานภายใน ${doc.delivery_days} วัน</div>` : ''}${quotationValidity}</section>` : '';
  if (doc.document_type === 'RC') {
    return `${terms}${signatures(doc)}`;
  }
  return `${terms}${paymentBox(doc)}${receiptPaymentDetails(doc, dateMode)}${signatures(doc)}`;
}

function renderPages(doc) {
  const displayItems = doc.document_type === 'RC' && doc.receipt_source_items?.length
    ? doc.receipt_source_items
    : doc.items;
  const groups = paginateItems(displayItems, doc);
  const totalPages = groups.length;
  let sequence = 0;
  const dateMode = printDateSelect ? printDateSelect.value : (localStorage.getItem('tong_billing_print_date_mode') || 'show');
  root.dataset.documentType = doc.document_type;
  root.innerHTML = groups.map((items, index) => {
    const pageNumber = index + 1;
    const isLast = pageNumber === groups.length;
    const rendered = itemRows(items, sequence);
    sequence = rendered.sequence;
    return `<section class="a4-sheet" data-document-type="${doc.document_type}">
      ${statusWatermark(doc)}${header(doc, pageNumber, dateMode)}${pageNumber === 1 ? customerBlock(doc, dateMode) : ''}
      ${table(rendered.html, isLast ? summaryRows(doc, dateMode) : '')}
      ${isLast ? finalBlocks(doc, dateMode) : ''}
      <div class="page-number">หน้า ${pageNumber}/${totalPages}</div>
    </section>`;
  }).join('');
  pageCount.textContent = `ตัวอย่าง A4: ${totalPages} หน้า`;
  pageWarning.classList.toggle('hidden', totalPages === 1);
  pageWarning.innerHTML = totalPages > 1
    ? `เอกสารนี้มี <strong>${displayItems.length} รายการ</strong> และใช้กระดาษ A4 จำนวน <strong>${totalPages} หน้า</strong> ระบบแบ่งหน้าให้อัตโนมัติโดยไม่ลบข้อมูล หากต้องการหน้าเดียว กรุณากลับไปรวบรายการ หรือส่งออก Excel เพื่อจัดรูปแบบสำเนาเอง`
    : '';
}

const PRINT_DEVICE_LABELS = {
  notebook: 'โน้ตบุ๊ก (Notebook)',
  pc: 'คอมพิวเตอร์ตั้งโต๊ะ (PC Desktop)',
  'all-in-one': 'All-in-One PC',
  macbook: 'MacBook / iMac',
  printer: 'เครื่องพิมพ์ (Printer)',
  monitor: 'จอภาพ (Monitor)',
  other: 'อุปกรณ์อื่น ๆ'
};

async function renderRepairTicket(repairId) {
  if (attachPanel) attachPanel.classList.add('hidden');
  if (excelButton) excelButton.classList.add('hidden');
  const editBtn = document.getElementById('edit-doc-button');
  if (editBtn) editBtn.classList.add('hidden');

  const { data: ticket } = await request(`/repairs/${repairId}`);
  let settings = {};
  try {
    const res = await request('/settings');
    settings = res.data || {};
  } catch { /* use defaults */ }

  const shopName = [settings.shop_name_th, settings.shop_name_en].filter(Boolean).join(' ') || 'ร้าน ต้อง เซอร์วิส ไอที (Tong Service IT)';
  const shopPhone = settings.shop_phone || '084-842-5950';
  const shopAddress = settings.shop_address || '445 หมู่ 5 ต.โคกยาง อ.เหนือคลอง จ.กระบี่ 81130';
  const logoUrl = settings.logo_url || './assets/logo-placeholder.svg';

  document.title = `${ticket.ticket_number} | ใบรับเครื่องซ่อมและสัญญาความยินยอม`;
  pageCount.textContent = 'ตัวอย่าง A4: 1 หน้า (ใบรับเครื่องและหนังสือสัญญา)';
  pageWarning.classList.add('hidden');

  const customer = ticket.customer_snapshot || {};
  const devLabel = PRINT_DEVICE_LABELS[ticket.device_type] || ticket.device_type;
  const estCost = Number(ticket.estimated_cost) || 0;
  const deposit = Number(ticket.deposit_amount) || 0;
  const balance = Math.max(0, estCost - deposit);

  const html = `
    <section class="a4-sheet repair-print-sheet" style="font-family:'Sarabun',sans-serif;color:#1e293b;padding:5mm 8mm;font-size:12.5px;line-height:1.45;position:relative;display:flex;flex-direction:column;justify-content:space-between;height:297mm;box-sizing:border-box;">
      
      <!-- ==================== ส่วนที่ 1: สำหรับร้านค้าเก็บเป็นหลักฐาน (Store Copy) ==================== -->
      <div class="repair-store-copy" style="flex:0 0 auto;">
        
        <!-- Header -->
        <div style="display:grid;grid-template-columns:55px 1fr auto;gap:10px;align-items:center;border-bottom:1.5px solid #0284c7;padding-bottom:6px;margin-bottom:6px;">
          <img src="${escapeHtml(logoUrl)}" alt="โลโก้" style="width:55px;height:55px;object-fit:contain;" onerror="this.onerror=null;this.src='./assets/logo-placeholder.svg'">
          <div>
            <h1 style="font-size:15px;font-weight:700;margin:0;color:#0f172a;">${escapeHtml(shopName)}</h1>
            <p style="margin:1px 0;font-size:11px;color:#475569;">${escapeHtml(shopAddress)} · โทร/LINE: ${escapeHtml(shopPhone)}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13.5px;font-weight:700;color:#0369a1;background:#e0f2fe;padding:2px 8px;border-radius:4px;display:inline-block;">ใบรับเครื่องซ่อมและหนังสือสัญญาความยินยอม</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;">(ต้นฉบับ - สำหรับร้านค้าเก็บเป็นหลักฐาน)</div>
            <div style="font-size:12px;margin-top:2px;"><strong>เลขที่:</strong> <span style="font-family:monospace;font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(ticket.ticket_number)}</span></div>
            <div style="font-size:11.5px;"><strong>วันที่รับ:</strong> ${dateThai(ticket.ticket_date)}</div>
          </div>
        </div>

        <!-- 2 Column Info: ลูกค้า & อุปกรณ์ -->
        <div style="display:grid;grid-template-columns:1fr 1.15fr;gap:8px;margin-bottom:6px;">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px 9px;background:#f8fafc;">
            <strong style="color:#0369a1;font-size:12px;display:block;border-bottom:1px solid #e2e8f0;padding-bottom:2px;margin-bottom:4px;">ข้อมูลผู้ส่งซ่อม (ลูกค้า)</strong>
            <div><strong>ชื่อ:</strong> ${escapeHtml(customer.name || '-')}</div>
            <div><strong>โทรศัพท์:</strong> ${escapeHtml(customer.phone || '-')}</div>
            <div style="font-size:11.5px;color:#475569;"><strong>ที่อยู่:</strong> ${escapeHtml(customer.address || '-')}</div>
          </div>

          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px 9px;background:#f8fafc;">
            <strong style="color:#0369a1;font-size:12px;display:block;border-bottom:1px solid #e2e8f0;padding-bottom:2px;margin-bottom:4px;">ข้อมูลอุปกรณ์และสภาพเครื่อง</strong>
            <div><strong>ประเภท:</strong> ${escapeHtml(devLabel)} · <strong>ยี่ห้อ/รุ่น:</strong> ${escapeHtml(ticket.brand_model)}</div>
            <div><strong>S/N:</strong> <span style="font-family:monospace;">${escapeHtml(ticket.serial_number || '-')}</span> · <strong>PIN/รหัสผ่าน:</strong> ${escapeHtml(ticket.passcode || 'ไม่มี')}</div>
            <div><strong>อุปกรณ์ที่นำมาด้วย:</strong> ${escapeHtml(ticket.accessories || 'ตัวเครื่องอย่างเดียว')}</div>
          </div>
        </div>

        <!-- Symptoms & Condition -->
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px 9px;margin-bottom:6px;background:#fff;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><strong>อาการเสียที่ลูกค้าแจ้ง:</strong> <span style="color:#b91c1c;font-weight:600;">${escapeHtml(ticket.symptoms)}</span></div>
            <div><strong>สภาพภายนอก / ตำหนิเดิม:</strong> ${escapeHtml(ticket.physical_condition || 'ปกติ / ไม่มีตำหนิชัดเจน')}</div>
          </div>
          <div style="display:flex;gap:20px;margin-top:4px;padding-top:4px;border-top:1px dashed #e2e8f0;font-size:11.5px;">
            <span><strong>ราคาประเมินเบื้องต้น:</strong> ฿${number(estCost)}</span>
            <span><strong>เงินมัดจำ:</strong> ฿${number(deposit)}</span>
            <span><strong>คงเหลือชำระวันรับเครื่อง:</strong> ฿${number(balance)}</span>
            <span><strong>กำหนดนัดรับ / แจ้งผล:</strong> ${ticket.appointment_date ? dateThai(ticket.appointment_date) : 'ทางร้านจะโทรแจ้งผล'}</span>
          </div>
        </div>

        <!-- Subcontracting Legal Terms -->
        <div style="border:1.5px solid #d97706;border-radius:6px;padding:7px 10px;background:#fffbeb;margin-bottom:8px;">
          <div style="font-weight:700;color:#92400e;font-size:12px;margin-bottom:3px;display:flex;align-items:center;gap:6px;">
            <span>⚖️ หนังสือสัญญาความยินยอมส่งซ่อมต่อศูนย์เฉพาะทาง และข้อตกลงการให้บริการ</span>
          </div>
          <div style="font-size:11px;color:#78350f;line-height:1.5;">
            ข้าพเจ้า (ลูกค้าตามชื่อข้างต้น) ได้ส่งมอบเครื่องอุปกรณ์ดังกล่าวข้างต้นให้แก่ร้าน ต้อง เซอร์วิส ไอที และรับทราบ ตกลง ยินยอมตามเงื่อนไขดังต่อไปนี้:
            <ol style="margin:3px 0 0 16px;padding:0;">
              <li><strong>ความยินยอมส่งต่อศูนย์เฉพาะทาง:</strong> ลูกค้ารับทราบและยินยอมให้ร้านฯ ดำเนินการส่งเครื่องต่อไปยังศูนย์บริการหรือช่างชำนาญการเฉพาะทางภายนอก เนื่องจากมีอาการเสียเกี่ยวกับระบบวงจรไฟฟ้า/เมนบอร์ดขั้นสูง (${escapeHtml(ticket.subcontract_reason || 'ต้องใช้เครื่องมือและช่างเฉพาะทาง')})</li>
              <li><strong>การประเมินราคา:</strong> ร้านจะติดต่อแจ้งผลตรวจเช็กและประเมินค่าใช้จ่ายเพื่อให้ลูกค้าอนุมัติก่อนลงมือดำเนินการซ่อมจริงทุกครั้ง (หากลูกค้าไม่อนุมัติซ่อม มีเพียงค่าตรวจเช็กตามที่ตกลง)</li>
              <li><strong>ความรับผิดชอบต่อข้อมูล:</strong> ลูกค้ามีหน้าที่สำรองข้อมูลสำคัญ ทางร้านและศูนย์ช่างภายนอกไม่รับผิดชอบต่อความสูญหายหรือเสียหายของข้อมูลในอุปกรณ์จัดเก็บข้อมูล (Harddisk/SSD) จากเหตุไฟฟ้าลัดวงจรหรือความชำรุดที่มีอยู่เดิม</li>
              <li><strong>ความเสียหายต่อเนื่อง:</strong> อุปกรณ์ที่ผ่านการช็อต ลัดวงจร หรือโดนน้ำ อาจมีชิ้นส่วนภายในเสื่อมสภาพสะสม ซึ่งอาจส่งผลต่อการทำงานส่วนอื่นในระหว่างหรือหลังการตรวจเช็ก</li>
              <li><strong>ระยะเวลาดำเนินการ:</strong> ระยะเวลาตรวจเช็กและส่งซ่อมภายนอกโดยประมาณ 7 - 14 วันทำการ (ไม่รวมวันหยุดนักขัตฤกษ์)</li>
            </ol>
          </div>
        </div>

        <!-- Store Signatures -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:6px;">
          <div style="text-align:center;border:1px dashed #cbd5e1;border-radius:6px;padding:8px;">
            <div style="height:32px;"></div>
            <div style="border-top:1px dotted #475569;width:75%;margin:0 auto 3px;"></div>
            <div style="font-size:11.5px;font-weight:600;">ลงชื่อ ........................................................... ผู้ส่งซ่อม / ผู้ยินยอมตามสัญญา</div>
            <div style="font-size:10.5px;color:#64748b;">( ${escapeHtml(customer.name || 'ลูกค้า')} ) วันที่ ......../......../........</div>
          </div>
          <div style="text-align:center;border:1px dashed #cbd5e1;border-radius:6px;padding:8px;">
            <div style="height:32px;"></div>
            <div style="border-top:1px dotted #475569;width:75%;margin:0 auto 3px;"></div>
            <div style="font-size:11.5px;font-weight:600;">ลงชื่อ ........................................................... ช่างผู้รับเครื่อง / ร้านต้อง เซอร์วิส ไอที</div>
            <div style="font-size:10.5px;color:#64748b;">( ผู้รับมอบเครื่องและเอกสาร ) วันที่ ......../......../........</div>
          </div>
        </div>

      </div>

      <!-- ==================== เส้นรอยปรุตัดกระดาษ ==================== -->
      <div style="border-top:1.5px dashed #94a3b8;margin:10px 0;position:relative;text-align:center;">
        <span style="position:relative;top:-10px;background:#fff;padding:0 12px;font-size:11px;color:#64748b;font-weight:600;">
          ✂ ตัดตามรอยปรุ (ท่อนล่างมอบให้ลูกค้าถือกลับบ้าน เป็นหลักฐานในการมารับเครื่อง)
        </span>
      </div>

      <!-- ==================== ส่วนที่ 2: ใบรับเครื่องสำหรับลูกค้า (Customer Copy) ==================== -->
      <div class="repair-customer-copy" style="flex:0 0 auto;border:1.5px solid #0284c7;border-radius:8px;padding:8px 12px;background:#f0f9ff;">
        
        <!-- Customer Part Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #bae6fd;padding-bottom:5px;margin-bottom:6px;">
          <div>
            <h2 style="font-size:14px;font-weight:700;margin:0;color:#0369a1;">ใบรับเครื่องซ่อม (สำหรับลูกค้า) · ${escapeHtml(shopName)}</h2>
            <div style="font-size:11px;color:#0284c7;">ติดต่อสอบถามสถานะงานซ่อม: โทร/LINE <strong>${escapeHtml(shopPhone)}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;"><strong>เลขที่ใบรับ:</strong> <span style="font-family:monospace;font-size:13px;font-weight:700;color:#0369a1;">${escapeHtml(ticket.ticket_number)}</span></div>
            <div style="font-size:11px;color:#475569;">วันที่รับเครื่อง: ${dateThai(ticket.ticket_date)}</div>
          </div>
        </div>

        <!-- Customer Part Details Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:6px;">
          <div>
            <div><strong>ลูกค้า:</strong> ${escapeHtml(customer.name || '-')} (โทร: ${escapeHtml(customer.phone || '-')})</div>
            <div><strong>อุปกรณ์:</strong> ${escapeHtml(devLabel)} ${escapeHtml(ticket.brand_model)}</div>
            <div><strong>S/N:</strong> <span style="font-family:monospace;">${escapeHtml(ticket.serial_number || '-')}</span></div>
          </div>
          <div>
            <div><strong>อุปกรณ์ที่นำมาด้วย:</strong> ${escapeHtml(ticket.accessories || 'ตัวเครื่องอย่างเดียว')}</div>
            <div><strong>อาการเสียที่แจ้ง:</strong> <span style="color:#b91c1c;font-weight:600;">${escapeHtml(ticket.symptoms)}</span></div>
            <div><strong>ราคาประเมินเบื้องต้น:</strong> ฿${number(estCost)} · <strong>มัดจำแล้ว:</strong> ฿${number(deposit)}</div>
          </div>
        </div>

        <!-- Customer Note & Claim Signature -->
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:10px;align-items:center;background:#fff;border:1px solid #bae6fd;border-radius:6px;padding:6px 10px;">
          <div style="font-size:10.5px;color:#475569;line-height:1.4;">
            <strong style="color:#0369a1;">เงื่อนไขสำคัญในการรับเครื่องคืน:</strong>
            <div>1. โปรดนำใบรับเครื่องนี้มาแสดงทุกครั้งเมื่อติดต่อรับเครื่อง</div>
            <div>2. ร้านจะโทรแจ้งผลตรวจเช็กและประเมินราคาก่อนเริ่มซ่อมแซมจริงทุกครั้ง</div>
            <div>3. หากไม่มารับเครื่องคืนภายใน 60 วันนับแต่วันที่แจ้ง ทางร้านขอสงวนสิทธิ์ในการจัดการตามระเบียบร้าน</div>
          </div>
          <div style="text-align:center;border-left:1px dashed #cbd5e1;padding-left:10px;">
            <div style="font-size:11px;color:#64748b;margin-bottom:18px;">ลงชื่อผู้รับเครื่องซ่อม</div>
            <div style="border-top:1px dotted #475569;width:80%;margin:0 auto 2px;"></div>
            <div style="font-size:11px;font-weight:600;">ร้าน ต้อง เซอร์วิส ไอที</div>
          </div>
        </div>

      </div>

    </section>
  `;

  root.innerHTML = html;
}

async function render() {
  const repairId = new URLSearchParams(location.search).get('repair_id');
  if (repairId) {
    await renderRepairTicket(repairId);
    return;
  }
  if (!id) throw new Error('ไม่พบรหัสเอกสาร');
  const { data: doc } = await request(`/documents/${id}`);
  currentDocument = doc;
  document.title = `${doc.document_number} | ${DOC_LABELS[doc.document_type]}`;
  renderPages(doc);
  // โหลด attachment meta (ถ้าเป็น QT)
  if (doc.document_type === 'QT') await loadAttachMeta();
}

render().catch((error) => {
  root.innerHTML = `<section class="a4-sheet"><p style="color:#b91c1c">${escapeHtml(error.message)}</p></section>`;
  pageCount.textContent = 'โหลดเอกสารไม่สำเร็จ';
});

// ============================================================
// Attachment PDF rendering (ใช้ PDF.js render เป็น canvas)
// ============================================================

/** แปลง base64 data URL → Uint8Array */
function base64ToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary  = atob(base64);
  const arr     = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

/**
 * Render หน้า PDF เป็น canvas แล้วเพิ่ม overlay:
 *   - สำเนาถูกต้อง + เส้น ....... (ทุกเอกสาร)
 *   - เส้นทะแยงสีน้ำเงิน + ข้อความ (เฉพาะบัตรประชาชน — พาดบนบัตรเท่านั้น)
 */
async function renderPdfPageToCanvas(pdfDoc, pageNum, attachType) {
  const page     = await pdfDoc.getPage(pageNum);
  // A4 ที่ 96 DPI = 794 x 1123 px; แต่ให้ scale ตาม viewport ของ PDF
  const A4_W     = 794;
  const viewport = page.getViewport({ scale: 1 });
  const scale    = A4_W / viewport.width;
  const scaledVP = page.getViewport({ scale });

  const canvas  = document.createElement('canvas');
  canvas.width  = scaledVP.width;
  canvas.height = scaledVP.height;
  const ctx     = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport: scaledVP }).promise;

  // ---- overlay: เส้นทะแยงสีน้ำเงิน (เฉพาะบัตรประชาชน — พาดบนตัวบัตรเท่านั้น) ----
  if (attachType === 'id-card') {
    const cW = scaledVP.width;
    const cH = scaledVP.height;

    // ขอบเขตตำแหน่งของบัตรประชาชนบนหน้าสแกน (ตรงกลางหน้า)
    const cardX = cW * 0.28;
    const cardY = cH * 0.35;
    const cardW = cW * 0.53;
    const cardH = cH * 0.29;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.clip(); // บังคับให้อยู่บนตัวบัตรเท่านั้น ไม่ล้นออกไปบนกระดาษสีขาว

    // กึ่งกลางบัตร
    const midX = cardX + cardW * 0.5;
    const midY = cardY + cardH * 0.5;
    const angle = -0.38; // มุมเอียงประมาณ -22 องศา (พาดจากซ้ายล่างขึ้นขวาบน)
    const lineSpacing = cW * 0.042; // ระยะห่างระหว่างเส้นขีดคร่อมคู่ 2 เส้น

    ctx.translate(midX, midY);
    ctx.rotate(angle);

    // เส้นขีดคร่อมคู่ (2 เส้นขนานสีน้ำเงิน)
    ctx.strokeStyle = '#0044cc';
    ctx.lineWidth   = 2;
    const lineLen   = cardW * 1.5;

    // เส้นบน
    ctx.beginPath();
    ctx.moveTo(-lineLen / 2, -lineSpacing / 2);
    ctx.lineTo( lineLen / 2, -lineSpacing / 2);
    ctx.stroke();

    // เส้นล่าง
    ctx.beginPath();
    ctx.moveTo(-lineLen / 2, lineSpacing / 2);
    ctx.lineTo( lineLen / 2, lineSpacing / 2);
    ctx.stroke();

    // ข้อความกำกับตรงกลางระหว่าง 2 เส้น
    ctx.font         = `bold ${Math.round(cW * 0.020)}px 'Sarabun', sans-serif`;
    ctx.fillStyle    = '#0033aa';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ใช้สำหรับการออกใบเสนอราคากับทางราชการเท่านั้น', 0, 0);

    ctx.restore();
  }

  // ---- overlay: "สำเนาถูกต้อง" + เส้นประสำหรับเขียนชื่อ (ย้ายมามุมล่างซ้าย เพื่อไม่ทับตราประทับ/ลายเซ็น/QR Code) ----
  const cW2   = scaledVP.width;
  const cH2   = scaledVP.height;
  const fSize = Math.round(cW2 * 0.032);  // ขนาดตัวอักษร

  ctx.save();
  // กล่องพื้นหลังขาวโปร่งเพื่อความคมชัด (มุมล่างซ้าย)
  const boxW  = cW2 * 0.38;
  const boxH  = fSize * 3.8;
  const boxX  = cW2 * 0.08;
  const boxY  = cH2 - boxH - cH2 * 0.035;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // คำว่า "สำเนาถูกต้อง"
  ctx.font      = `bold ${fSize}px 'Sarabun', sans-serif`;
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const cx = boxX + boxW / 2;
  ctx.fillText('สำเนาถูกต้อง', cx, boxY + fSize * 0.2);

  // เส้นประสำหรับเซ็นชื่อกำกับด้วยลายมือ (ขยับลงมาด้านล่าง ให้มีระยะเขียนพอดี)
  ctx.strokeStyle = '#222';
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([4, 4]);
  const lineY = boxY + fSize * 2.6;
  ctx.beginPath();
  ctx.moveTo(boxX + boxW * 0.05, lineY);
  ctx.lineTo(boxX + boxW * 0.95, lineY);
  ctx.stroke();

  ctx.restore();

  return canvas;
}

/** สร้าง A4 section จาก canvas */
function canvasToA4Section(canvas, pageLabel) {
  const section = document.createElement('section');
  section.className = 'a4-sheet a4-sheet--attach';
  canvas.style.cssText = 'width:100%;height:auto;display:block;';
  section.appendChild(canvas);
  if (pageLabel) {
    const pg = document.createElement('div');
    pg.className = 'page-number';
    pg.textContent = pageLabel;
    section.appendChild(pg);
  }
  return section;
}

let attachRenderToken = 0;

/** ลบหน้าแนบเก่าออก แล้ว render ใหม่ตามที่ติ๊ก (ป้องกัน Race Condition และจำกัดทะเบียนพาณิชย์ 1 แผ่น) */
async function renderAttachPages() {
  const currentToken = ++attachRenderToken;
  if (!window.pdfjsLib) return;

  const checked = ['id-card','commercial-reg','sme-gp'].filter((type) => {
    const cb = document.getElementById(`attach-cb-${type}`);
    return cb && cb.checked && !cb.disabled;
  });

  if (checked.length === 0) {
    root.querySelectorAll('.a4-sheet--attach').forEach((el) => el.remove());
    return;
  }

  const newSections = [];

  // โหลดและ render ทีละไฟล์เข้า buffer ในหน่วยความจำก่อน
  for (const type of checked) {
    if (currentToken !== attachRenderToken) return; // ยกเลิกหากมีการเรียกซ้ำใหม่
    try {
      const { data: base64 } = await request(`/settings/attachment/${type}`);
      if (!base64 || currentToken !== attachRenderToken) continue;

      const bytes   = base64ToUint8Array(base64);
      const pdfDoc  = await pdfjsLib.getDocument({ data: bytes }).promise;

      // ใบทะเบียนพาณิชย์ และบัตรประชาชน กำหนดให้แสดงเพียง 1 แผ่นถ้วน
      const maxPages = (type === 'commercial-reg' || type === 'id-card') ? 1 : pdfDoc.numPages;
      const totalPg  = Math.min(pdfDoc.numPages, maxPages);

      for (let pg = 1; pg <= totalPg; pg++) {
        if (currentToken !== attachRenderToken) return;
        const canvas  = await renderPdfPageToCanvas(pdfDoc, pg, type);
        const section = canvasToA4Section(canvas, null);
        newSections.push(section);
      }
    } catch (err) {
      console.error(`renderAttachPages [${type}]:`, err);
    }
  }

  // หากมีการเรียกใหม่ระหว่างรอ ให้ข้ามไป
  if (currentToken !== attachRenderToken) return;

  // นำหน้าแนบชุดใหม่ไปต่อท้ายหน้าใบเสนอราคาเพียงรอบเดียวจบ
  root.querySelectorAll('.a4-sheet--attach').forEach((el) => el.remove());
  newSections.forEach((sec) => root.appendChild(sec));
}
