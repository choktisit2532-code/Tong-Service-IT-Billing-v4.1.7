const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const AppError = require('../utils/app-error');
const { settingsSchema } = require('../validators/schemas');
const logger = require('../utils/logger');

const router = express.Router();

// ---- Attachment document constants ----
const ATTACH_TYPES = {
    'id-card':         { col: 'attach_id_card_data',        expiryCol: 'attach_id_card_expiry',  hasExpiry: true  },
    'commercial-reg':  { col: 'attach_commercial_reg_data', expiryCol: null,                     hasExpiry: false },
    'sme-gp':          { col: 'attach_sme_gp_data',         expiryCol: 'attach_sme_gp_expiry',   hasExpiry: true  }
};
const PDF_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

router.get('/public-branding', asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const result = await pool.query(
            `SELECT shop_name_th, shop_name_en, logo_url
             FROM settings
             WHERE id = 1`
        );
        return res.json({ data: result.rows[0] || null });
    } catch (error) {
        logger.warn('settings.public_branding_unavailable', { message: error.message, code: error.code });
        return res.json({ data: null });
    }
}));

router.use(authenticate);

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024, files: 1 },
    fileFilter(_req, file, callback) {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            return callback(new AppError(
                400,
                'รองรับเฉพาะไฟล์ PNG, JPG/JPEG และ WebP',
                'INVALID_IMAGE_TYPE'
            ));
        }
        callback(null, true);
    }
});

function hasValidImageSignature(file) {
    const buffer = file.buffer;
    if (file.mimetype === 'image/png') {
        return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]));
    }
    if (file.mimetype === 'image/jpeg') {
        return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    if (file.mimetype === 'image/webp') {
        return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
}

function imageDataUrl(file, label) {
    if (!file) throw new AppError(400, `กรุณาเลือกไฟล์${label}`, 'IMAGE_REQUIRED');
    if (!hasValidImageSignature(file)) {
        throw new AppError(400, `เนื้อหาไฟล์${label}ไม่ตรงกับประเภทไฟล์ที่เลือก`, 'INVALID_IMAGE_CONTENT');
    }
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

router.get('/', asyncHandler(async (_req, res) => {
    const result = await pool.query('SELECT * FROM settings WHERE id=1');
    res.json({ data: result.rows[0] });
}));

router.post('/logo', authorize('settings.update'), upload.single('logo'), asyncHandler(async (req, res) => {
    const source = imageDataUrl(req.file, 'โลโก้');
    const result = await pool.query(
        'UPDATE settings SET logo_url=$1 WHERE id=1 RETURNING *',
        [source]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ data: result.rows[0] });
}));

router.post('/signature', authorize('settings.update'), upload.single('signature'), asyncHandler(async (req, res) => {
    const source = imageDataUrl(req.file, 'ลายเซ็น');
    const result = await pool.query(
        'UPDATE settings SET saved_signature_url=$1 WHERE id=1 RETURNING *',
        [source]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ data: result.rows[0] });
}));

router.put('/', authorize('settings.update'), validate(settingsSchema), asyncHandler(async (req, res) => {
    const b = req.body;
    const result = await pool.query(
        `UPDATE settings SET
          shop_name_th=$1,shop_name_en=$2,shop_owner=$3,shop_address=$4,
          shop_tax_id=$5,shop_phone=$6,shop_email=$7,scb_bank_details=$8,
          ktb_bank_details=$9,logo_url=$10,saved_signature_url=$11,
          numbering_config=$12::jsonb,feature_flags=$13::jsonb
         WHERE id=1 RETURNING *`,
        [b.shop_name_th,b.shop_name_en,b.shop_owner,b.shop_address,b.shop_tax_id,
         b.shop_phone,b.shop_email,b.scb_bank_details,b.ktb_bank_details,b.logo_url,
         b.saved_signature_url,JSON.stringify(b.numbering_config),JSON.stringify(b.feature_flags)]
    );
    res.json({ data: result.rows[0] });
}));

// ---- PDF upload middleware ----
const uploadPdf = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PDF_MAX_SIZE, files: 1 },
    fileFilter(_req, file, callback) {
        if (file.mimetype !== 'application/pdf') {
            return callback(new AppError(400, 'รองรับเฉพาะไฟล์ PDF', 'INVALID_FILE_TYPE'));
        }
        callback(null, true);
    }
});

function isPdfBuffer(buf) {
    return buf && buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF';
}

// GET /api/settings/attachment/:type — ส่งคืน base64 PDF
router.get('/attachment/:type', authenticate, asyncHandler(async (req, res) => {
    const info = ATTACH_TYPES[req.params.type];
    if (!info) throw new AppError(404, 'ไม่พบประเภทเอกสาร', 'NOT_FOUND');
    const result = await pool.query(`SELECT ${info.col} AS data FROM settings WHERE id=1`);
    const data = result.rows[0]?.data || null;
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
}));

// GET /api/settings/attachments/meta — ส่งคืน metadata (ไม่รวม PDF data) + สถานะหมดอายุ
router.get('/attachments/meta', authenticate, asyncHandler(async (_req, res) => {
    const result = await pool.query(`
        SELECT
          CASE WHEN attach_id_card_data IS NOT NULL THEN TRUE ELSE FALSE END        AS has_id_card,
          attach_id_card_expiry,
          CASE WHEN attach_commercial_reg_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_commercial_reg,
          CASE WHEN attach_sme_gp_data IS NOT NULL THEN TRUE ELSE FALSE END         AS has_sme_gp,
          attach_sme_gp_expiry
        FROM settings WHERE id=1
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ data: result.rows[0] || null });
}));

// POST /api/settings/attachment/:type — อัปโหลด PDF
router.post('/attachment/:type',
    authenticate,
    authorize('settings.update'),
    uploadPdf.single('file'),
    asyncHandler(async (req, res) => {
        const info = ATTACH_TYPES[req.params.type];
        if (!info) throw new AppError(404, 'ไม่พบประเภทเอกสาร', 'NOT_FOUND');
        if (!req.file) throw new AppError(400, 'กรุณาเลือกไฟล์ PDF', 'FILE_REQUIRED');
        if (!isPdfBuffer(req.file.buffer)) throw new AppError(400, 'ไฟล์ไม่ใช่ PDF ที่ถูกต้อง', 'INVALID_PDF');

        const base64 = `data:application/pdf;base64,${req.file.buffer.toString('base64')}`;

        // อัปเดต expiry ถ้ามีส่งมา
        let query, params;
        if (info.hasExpiry && req.body.expiry) {
            const expiryDate = req.body.expiry; // YYYY-MM-DD
            query = `UPDATE settings SET ${info.col}=$1, ${info.expiryCol}=$2 WHERE id=1`;
            params = [base64, expiryDate];
        } else {
            query = `UPDATE settings SET ${info.col}=$1 WHERE id=1`;
            params = [base64];
        }
        await pool.query(query, params);
        logger.info('settings.attachment_uploaded', { type: req.params.type });
        res.set('Cache-Control', 'no-store');
        res.json({ success: true });
    })
);

// PUT /api/settings/attachment/:type/expiry — อัปเดตวันหมดอายุอย่างเดียว
router.put('/attachment/:type/expiry',
    authenticate,
    authorize('settings.update'),
    asyncHandler(async (req, res) => {
        const info = ATTACH_TYPES[req.params.type];
        if (!info || !info.hasExpiry) throw new AppError(404, 'ไม่พบประเภทเอกสารหรือไม่มีวันหมดอายุ', 'NOT_FOUND');
        const { expiry } = req.body;
        if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
            throw new AppError(400, 'รูปแบบวันหมดอายุไม่ถูกต้อง (YYYY-MM-DD)', 'INVALID_DATE');
        }
        await pool.query(`UPDATE settings SET ${info.expiryCol}=$1 WHERE id=1`, [expiry]);
        res.json({ success: true });
    })
);

// DELETE /api/settings/attachment/:type — ลบเอกสาร
router.delete('/attachment/:type',
    authenticate,
    authorize('settings.update'),
    asyncHandler(async (req, res) => {
        const info = ATTACH_TYPES[req.params.type];
        if (!info) throw new AppError(404, 'ไม่พบประเภทเอกสาร', 'NOT_FOUND');
        const cols = info.hasExpiry
            ? `${info.col}=NULL, ${info.expiryCol}=NULL`
            : `${info.col}=NULL`;
        await pool.query(`UPDATE settings SET ${cols} WHERE id=1`);
        res.json({ success: true });
    })
);

module.exports = router;
