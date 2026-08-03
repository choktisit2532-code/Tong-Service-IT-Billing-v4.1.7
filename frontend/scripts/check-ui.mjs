import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [html, appJs, printHtml, printCss] = await Promise.all([
  fs.readFile(path.join(root, 'src/app.html'), 'utf8'),
  fs.readFile(path.join(root, 'src/js/app.js'), 'utf8'),
  fs.readFile(path.join(root, 'src/print.html'), 'utf8'),
  fs.readFile(path.join(root, 'src/css/print.css'), 'utf8')
]);
const printJs = await fs.readFile(path.join(root, 'src/js/print.js'), 'utf8');
const excelJs = await fs.readFile(path.join(root, 'src/js/excel-export.js'), 'utf8');

const requiredIds = [
  'doc-customer', 'doc-customer-load-status', 'doc-refresh-customers', 'doc-retry-customers', 'doc-toggle-quick-customer',
  'doc-quick-customer', 'doc-save-quick-customer', 'doc-date',
  'doc-term-days', 'doc-due-date', 'doc-recalculate-due', 'doc-validity-days', 'doc-show-signature',
  'undo-item-order', 'source-documents-refresh', 'source-empty-message'
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI element: ${id}`);
  if (!appJs.includes(`#${id}`)) throw new Error(`UI element is not wired in app.js: ${id}`);
}

if (!appJs.includes("label: 'ยืนยันรับชำระ'")) throw new Error('Missing receipt payment confirmation action');
if (!appJs.includes('preserveEditingDocumentCustomer(doc)')) throw new Error('Editing a document does not preserve its original customer');
if (!appJs.includes('editingOriginalCustomerId')) throw new Error('Missing original customer fallback for document editing');
if (appJs.includes("customer_id: Number($('#doc-customer').value)")) throw new Error('Document save can still send customer_id=0 from an empty select');
if (printHtml.includes('fonts.googleapis.com')) throw new Error('Print page still depends on Google Fonts');
if (!printCss.includes('sarabun-thai-400-normal.woff2')) throw new Error('Embedded regular Thai font is not configured');
if (!printCss.includes('sarabun-thai-700-normal.woff2')) throw new Error('Embedded bold Thai font is not configured');
if (!printHtml.includes('id="page-count"') || !printHtml.includes('id="page-warning"')) throw new Error('A4 page preview status is missing');
if (!printHtml.includes('id="excel-button"')) throw new Error('Excel export button is missing');
if (!printJs.includes('paginateItems') || !printJs.includes('หน้า ${pageNumber}/${totalPages}')) throw new Error('Print preview is not paginated');
if (!printHtml.includes('./vendor/exceljs.min.js')) throw new Error('Styled Excel engine is not loaded');
if (!printJs.includes('downloadExcelDocument')) throw new Error('Editable Excel export is not wired');
if (!excelJs.includes('fitToWidth:1') || !excelJs.includes("paperSize:9")) throw new Error('Excel A4 page setup is missing');
if (!excelJs.includes('BAHTTEXT') || !excelJs.includes('C${rowNumber}*E${rowNumber}')) throw new Error('Editable Excel formulas are missing');
if (!excelJs.includes('settings.logo_url') || !excelJs.includes('saved_signature_url')) throw new Error('Excel branding images are not wired');
if (!appJs.includes('recalculate_due_date')) throw new Error('Document date due-date recalculation option is missing');
if (!appJs.includes("general: ['QT','IN','RC','DO']")) throw new Error('General customers still cannot create invoices');
if (!appJs.includes("['private','general'].includes(d.customer_type)")) throw new Error('General quotations cannot continue to an invoice');
if (html.includes('doc-lock-item-order')) throw new Error('Obsolete item-order lock switch is still present');
if (!appJs.includes("$('.move-line-up', row).addEventListener")) throw new Error('Move-up control is not wired');
if (!appJs.includes("$('.move-line-down', row).addEventListener")) throw new Error('Move-down control is not wired');
if (!appJs.includes("positionInput.addEventListener('change', applyTypedPosition)")) throw new Error('Direct position entry is not wired');
if (!appJs.includes('undoDocumentItemOrder')) throw new Error('Item-order undo is not wired');
if (!appJs.includes('refreshDocumentLineOrderControls')) throw new Error('Item-order controls do not refresh');
if (!appJs.includes("dragHandle.addEventListener('pointerdown', armDrag)")) throw new Error('Item reordering is not armed from the 6-dot drag handle');
if (!appJs.includes("row.dataset.dragArmed = 'true'")) throw new Error('Drag is not armed only during a handle press');
if (!appJs.includes('row.draggable = true')) throw new Error('The row is not made draggable while its handle is held');
if (!appJs.includes("document.addEventListener('pointerup', () => resetDocumentLineDrag())")) throw new Error('Item position is not re-locked on mouse release');
if (!appJs.includes("/customers?limit=200&page=1&status=all', { cache: 'no-store' }")) throw new Error('Document customer dropdown does not load all customers for legacy compatibility');
if (!appJs.includes('cachedActiveCustomers')) throw new Error('Document customer dropdown has no cache fallback');
if (!appJs.includes('documentCustomerRequestSequence')) throw new Error('Document customer refresh has no stale-response protection');
if (!appJs.includes('normaliseDocumentCustomers')) throw new Error('Document customer results are not normalised');
if (!appJs.includes('if (value == null) return true;')) throw new Error('Legacy customers with active=NULL are still hidden');
if (!appJs.includes("$('#doc-quick-customer').classList.add('hidden');")) throw new Error('Quick customer form is not collapsed when opening the document modal');
if (!appJs.includes("/customers/document-options?_=${Date.now()}")) throw new Error('Document customer dropdown does not use its dedicated cache-busted endpoint');
if (!appJs.includes("setDocumentCustomerLoadStatus('กำลังโหลดรายชื่อลูกค้า...')")) throw new Error('Customer loading status is not displayed in the document modal');
if (!appJs.includes('โหลดรายชื่อลูกค้าไม่สำเร็จ กรุณากดลองใหม่')) throw new Error('Customer retry state is not displayed in the document modal');
if (!appJs.includes("const customerLoad = refreshDocumentCustomers();")) throw new Error('Document modal still waits before customer loading starts');
if (appJs.includes('const customersReady = await refreshDocumentCustomers();')) throw new Error('Document modal still blocks on customer loading before opening');
if (appJs.includes('bindMasterDataButtons(); renderCustomerOptions(); refreshIcons();')) throw new Error('Customer-management page can still mutate the document dropdown');
if (!appJs.includes("/documents/sources?target_type=${targetType}&customer_id=${customerId}`, { cache: 'no-store' }")) throw new Error('Source document list can still use a stale browser cache');
if (!appJs.includes('preferredSourceSelected')) throw new Error('Preferred source document is not verified after loading');

for (const filename of ['sarabun-thai-400-normal.woff2', 'sarabun-thai-700-normal.woff2', 'OFL.txt']) {
  const stat = await fs.stat(path.join(root, 'src/assets/fonts', filename));
  if (!stat.isFile() || stat.size === 0) throw new Error(`Missing embedded font asset: ${filename}`);
}

console.log('Frontend UI checks passed');
