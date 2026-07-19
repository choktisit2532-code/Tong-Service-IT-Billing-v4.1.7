const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();
router.use(authenticate, authorize('audit.view'));

function buildWhere(query) {
  const where = [];
  const values = [];
  if (query.start_date) {
    values.push(query.start_date);
    where.push(`a.created_at >= $${values.length}::date`);
  }
  if (query.end_date) {
    values.push(query.end_date);
    where.push(`a.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (query.action) {
    values.push(query.action);
    where.push(`a.action = $${values.length}`);
  }
  if (query.entity_type) {
    values.push(query.entity_type);
    where.push(`a.entity_type = $${values.length}`);
  }
  if (query.user_id) {
    values.push(query.user_id);
    where.push(`a.user_id = $${values.length}`);
  }
  if (query.search) {
    values.push(`%${query.search}%`);
    where.push(`(a.entity_id ILIKE $${values.length} OR a.details::text ILIKE $${values.length})`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const { sql, values } = buildWhere(req.query);
  const dataParams = [...values, limit, offset];

  const [rows, count, actions, entities, users] = await Promise.all([
    pool.query(`
      SELECT a.id,a.user_id,u.name AS user_name,a.action,a.entity_type,a.entity_id,a.details,a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ${sql}
      ORDER BY a.created_at DESC,a.id DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, dataParams),
    pool.query(`SELECT COUNT(*)::integer AS total FROM audit_logs a ${sql}`, values),
    pool.query(`SELECT DISTINCT action FROM audit_logs ORDER BY action`),
    pool.query(`SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type`),
    pool.query(`SELECT id,name,email,role FROM users ORDER BY name`)
  ]);

  res.json({
    data: rows.rows,
    meta: { page, limit, total: count.rows[0]?.total || 0 },
    filters: { actions: actions.rows.map((r) => r.action), entity_types: entities.rows.map((r) => r.entity_type), users: users.rows }
  });
}));

router.get('/export', authorize('audit.export'), asyncHandler(async (req, res) => {
  const { sql, values } = buildWhere(req.query);
  const result = await pool.query(`
    SELECT a.created_at,u.name AS user_name,a.action,a.entity_type,a.entity_id,a.details
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ${sql}
    ORDER BY a.created_at DESC,a.id DESC
    LIMIT 5000`, values);
  res.json({ data: result.rows });
}));

module.exports = router;
