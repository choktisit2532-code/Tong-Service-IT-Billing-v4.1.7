const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const { getCache, setCache } = require('../utils/cache');
const { monthSchema } = require('../validators/schemas');
const { getMonthlyReport, getAdvancedReports } = require('../services/report.service');

const router = express.Router();
router.use(authenticate);

router.get('/monthly', authorize('report.view'), validate(monthSchema, 'query'), asyncHandler(async (req, res) => {
    res.json(await getMonthlyReport(req.query.month));
}));

router.get('/advanced', authorize('report.view'), asyncHandler(async (req, res) => {
    const cacheKey = `report:advanced:${JSON.stringify(req.query || {})}`;
    const cached = getCache(cacheKey);
    if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json({ data: cached });
    }
    res.set('X-Cache', 'MISS');
    const data = await getAdvancedReports(req.query);
    return res.json({ data: setCache(cacheKey, data, 60000) });
}));

module.exports = router;
