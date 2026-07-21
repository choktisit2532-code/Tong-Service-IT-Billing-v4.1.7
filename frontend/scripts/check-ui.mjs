import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [html, appJs, printHtml, printCss] = await Promise.all([
  fs.readFile(path.join(root, 'src/app.html'), 'utf8'),
  fs.readFile(path.join(root, 'src/js/app.js'), 'utf8'),
  fs.readFile(path.join(root, 'src/print.html'), 'utf8'),
  fs.readFile(path.join(root, 'src/css/print.css'), 'utf8')
]);

const requiredIds = [
  'doc-customer', 'doc-refresh-customers', 'doc-toggle-quick-customer',
  'doc-quick-customer', 'doc-save-quick-customer', 'doc-date',
  'doc-term-days', 'doc-due-date', 'doc-validity-days', 'doc-show-signature'
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

for (const filename of ['sarabun-thai-400-normal.woff2', 'sarabun-thai-700-normal.woff2', 'OFL.txt']) {
  const stat = await fs.stat(path.join(root, 'src/assets/fonts', filename));
  if (!stat.isFile() || stat.size === 0) throw new Error(`Missing embedded font asset: ${filename}`);
}

console.log('Frontend UI checks passed');
