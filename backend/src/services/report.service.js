const pool = require('../config/db');

function normalizeRange(query = {}) {
  const start = query.start_date || (query.month ? `${query.month}-01` : null);
  const end = query.end_date || null;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) };
  }
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const d = new Date(`${start}T00:00:00Z`);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { startDate: start, endDate: last.toISOString().slice(0, 10) };
  }
  return { startDate: start, endDate: end };
}

function normalizeReportLimit(value, fallback = 300, max = 1000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

const activeDocumentCondition = `d.deleted_at IS NULL AND d.status <> 'CANCELLED'`;

async function getAdvancedReports(query = {}) {
  const { startDate, endDate } = normalizeRange(query);
  const limit = normalizeReportLimit(query.limit);
  const params = [startDate, endDate];

  const [revenue, receivables, aging, withholding, transferFees, topCustomers, salesByType, cancelledDocuments] = await Promise.all([
    pool.query(`
      SELECT d.document_date::date AS date,
             COALESCE(SUM(d.product_subtotal),0) AS product_total,
             COALESCE(SUM(d.service_subtotal),0) AS service_total,
             COALESCE(SUM(d.other_subtotal),0) AS other_total,
             COALESCE(SUM(d.net_total) FILTER (WHERE d.document_type = 'RC'),0) AS received_total,
             COUNT(*)::integer AS document_count
      FROM documents d
      WHERE ${activeDocumentCondition}
        AND d.document_date BETWEEN $1::date AND $2::date
      GROUP BY d.document_date
      ORDER BY d.document_date`, params),
    pool.query(`
      SELECT d.id,d.document_number,d.document_type,d.document_date,d.due_date,d.status,
             d.grand_total,d.net_total,c.name AS customer_name,
             GREATEST((CURRENT_DATE - COALESCE(d.due_date,d.document_date)),0)::integer AS overdue_days
      FROM documents d JOIN customers c ON c.id = d.customer_id
      WHERE d.deleted_at IS NULL
        AND d.status IN ('PENDING','APPROVED','IN_PROGRESS','OVERDUE')
        AND d.document_type IN ('IN','BN')
        AND NOT EXISTS (
          SELECT 1 FROM document_relations r
          JOIN documents rc ON rc.id = r.target_document_id
          WHERE r.source_document_id = d.id
            AND r.relation_type = 'PAID_BY'
            AND rc.document_type = 'RC'
            AND rc.deleted_at IS NULL
            AND rc.status <> 'CANCELLED'
        )
      ORDER BY COALESCE(d.due_date,d.document_date), d.id`, []),
    pool.query(`
      WITH receivable_docs AS (
        SELECT d.grand_total,
               GREATEST((CURRENT_DATE - COALESCE(d.due_date,d.document_date)),0)::integer AS overdue_days
        FROM documents d
        WHERE d.deleted_at IS NULL
          AND d.status IN ('PENDING','APPROVED','IN_PROGRESS','OVERDUE')
          AND d.document_type IN ('IN','BN')
          AND NOT EXISTS (
            SELECT 1 FROM document_relations r
            JOIN documents rc ON rc.id = r.target_document_id
            WHERE r.source_document_id = d.id
              AND r.relation_type = 'PAID_BY'
              AND rc.document_type = 'RC'
              AND rc.deleted_at IS NULL
              AND rc.status <> 'CANCELLED'
          )
      )
      SELECT bucket, COUNT(*)::integer AS document_count, COALESCE(SUM(grand_total),0) AS total
      FROM (
        SELECT grand_total,
          CASE
            WHEN overdue_days = 0 THEN 'ยังไม่ครบกำหนด'
            WHEN overdue_days BETWEEN 1 AND 30 THEN 'เกิน 1-30 วัน'
            WHEN overdue_days BETWEEN 31 AND 60 THEN 'เกิน 31-60 วัน'
            WHEN overdue_days BETWEEN 61 AND 90 THEN 'เกิน 61-90 วัน'
            ELSE 'เกิน 90 วัน'
          END AS bucket
        FROM receivable_docs
      ) x
      GROUP BY bucket
      ORDER BY CASE bucket
        WHEN 'ยังไม่ครบกำหนด' THEN 0
        WHEN 'เกิน 1-30 วัน' THEN 1
        WHEN 'เกิน 31-60 วัน' THEN 2
        WHEN 'เกิน 61-90 วัน' THEN 3
        ELSE 4 END`, []),
    pool.query(`
      SELECT d.id,d.document_number,d.document_date,d.payment_received_date,c.name AS customer_name,
             d.grand_total,d.withholding_rate,d.withholding_base,d.withholding_amount,d.net_total
      FROM documents d JOIN customers c ON c.id=d.customer_id
      WHERE d.deleted_at IS NULL
        AND d.status <> 'CANCELLED'
        AND d.document_type = 'RC'
        AND d.withholding_amount > 0
        AND COALESCE(d.payment_received_date,d.document_date) BETWEEN $1::date AND $2::date
      ORDER BY COALESCE(d.payment_received_date,d.document_date), d.id`, params),
    pool.query(`
      SELECT d.id,d.document_number,d.document_date,d.payment_received_date,c.name AS customer_name,
             d.grand_total,d.transfer_fee,d.net_total
      FROM documents d JOIN customers c ON c.id=d.customer_id
      WHERE d.deleted_at IS NULL
        AND d.status <> 'CANCELLED'
        AND d.document_type = 'RC'
        AND d.transfer_fee > 0
        AND COALESCE(d.payment_received_date,d.document_date) BETWEEN $1::date AND $2::date
      ORDER BY COALESCE(d.payment_received_date,d.document_date), d.id`, params),
    pool.query(`
      SELECT c.id AS customer_id,c.name AS customer_name,
             COUNT(d.id)::integer AS document_count,
             COALESCE(SUM(d.grand_total),0) AS gross_total,
             COALESCE(SUM(d.net_total) FILTER (WHERE d.document_type='RC'),0) AS received_total,
             COALESCE(SUM(d.withholding_amount) FILTER (WHERE d.document_type='RC'),0) AS withholding_total,
             COALESCE(SUM(d.transfer_fee) FILTER (WHERE d.document_type='RC'),0) AS transfer_fee_total
      FROM documents d JOIN customers c ON c.id=d.customer_id
      WHERE ${activeDocumentCondition}
        AND d.document_date BETWEEN $1::date AND $2::date
      GROUP BY c.id,c.name
      ORDER BY gross_total DESC
      LIMIT 10`, params),
    pool.query(`
      SELECT COALESCE(di.item_type,'other') AS item_type,
             COUNT(di.id)::integer AS item_count,
             COALESCE(SUM(di.line_total),0) AS total_sales
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      WHERE d.deleted_at IS NULL
        AND d.status <> 'CANCELLED'
        AND di.line_type = 'item'
        AND d.document_date BETWEEN $1::date AND $2::date
      GROUP BY COALESCE(di.item_type,'other')
      ORDER BY total_sales DESC`, params),
    pool.query(`
      SELECT d.id,d.document_number,d.document_type,d.document_date,d.cancelled_at,d.cancellation_reason,
             d.grand_total,c.name AS customer_name,u.name AS cancelled_by_name
      FROM documents d
      JOIN customers c ON c.id=d.customer_id
      LEFT JOIN users u ON u.id=d.cancelled_by
      WHERE d.deleted_at IS NULL
        AND d.status = 'CANCELLED'
        AND COALESCE(d.cancelled_at::date,d.document_date) BETWEEN $1::date AND $2::date
      ORDER BY COALESCE(d.cancelled_at,d.updated_at) DESC,d.id DESC
      LIMIT $3`, [...params, limit])
  ]);

  const revenueSummary = revenue.rows.reduce((acc, row) => {
    acc.product_total += Number(row.product_total || 0);
    acc.service_total += Number(row.service_total || 0);
    acc.other_total += Number(row.other_total || 0);
    acc.received_total += Number(row.received_total || 0);
    acc.document_count += Number(row.document_count || 0);
    return acc;
  }, { product_total: 0, service_total: 0, other_total: 0, received_total: 0, document_count: 0 });

  return {
    range: { start_date: startDate, end_date: endDate },
    summary: {
      ...revenueSummary,
      receivable_total: receivables.rows.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
      withholding_total: withholding.rows.reduce((sum, row) => sum + Number(row.withholding_amount || 0), 0),
      transfer_fee_total: transferFees.rows.reduce((sum, row) => sum + Number(row.transfer_fee || 0), 0),
      cancelled_total: cancelledDocuments.rows.reduce((sum, row) => sum + Number(row.grand_total || 0), 0)
    },
    revenue: revenue.rows,
    receivables: receivables.rows,
    aging: aging.rows,
    withholding_tax: withholding.rows,
    transfer_fees: transferFees.rows,
    top_customers: topCustomers.rows,
    sales_by_type: salesByType.rows,
    cancelled_documents: cancelledDocuments.rows
  };
}

async function getMonthlyReport(month) {
  const start = `${month}-01`;
  const [summary, byType, documents] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(product_subtotal),0) AS product_total,
          COALESCE(SUM(service_subtotal),0) AS service_total,
          COALESCE(SUM(grand_total),0) AS gross_total,
          COALESCE(SUM(net_total) FILTER (WHERE document_type='RC'),0) AS received_total,
          COALESCE(SUM(withholding_amount) FILTER (WHERE document_type='RC'),0) AS withholding_total,
          COALESCE(SUM(transfer_fee),0) AS transfer_fee_total,
          COUNT(*)::integer AS document_count
        FROM documents
        WHERE document_date >= $1::date
          AND document_date < ($1::date + INTERVAL '1 month')
          AND status <> 'CANCELLED'
          AND deleted_at IS NULL`, [start]),
      pool.query(`
        SELECT document_type,COUNT(*)::integer AS count,COALESCE(SUM(grand_total),0) AS total
        FROM documents
        WHERE document_date >= $1::date
          AND document_date < ($1::date + INTERVAL '1 month')
          AND status <> 'CANCELLED'
          AND deleted_at IS NULL
        GROUP BY document_type ORDER BY document_type`, [start]),
      pool.query(`
        SELECT d.id,d.document_number,d.document_type,d.document_date,d.status,
               d.grand_total,d.withholding_amount,d.transfer_fee,d.net_total,c.name AS customer_name
        FROM documents d JOIN customers c ON c.id=d.customer_id
        WHERE d.deleted_at IS NULL
          AND d.status <> 'CANCELLED'
          AND d.document_date >= $1::date
          AND d.document_date < ($1::date + INTERVAL '1 month')
        ORDER BY d.document_date,d.id`, [start])
  ]);
  return { month, summary: summary.rows[0], by_type: byType.rows, documents: documents.rows };
}

module.exports = { getAdvancedReports, getMonthlyReport, normalizeRange };
