const AppError = require('../utils/app-error');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
    next(new AppError(404, `ไม่พบเส้นทาง ${req.method} ${req.path}`, 'NOT_FOUND'));
}

function mapKnownError(error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
        return new AppError(400, 'ไฟล์โลโก้ต้องมีขนาดไม่เกิน 500 KB', 'LOGO_TOO_LARGE');
    }
    if (error.name === 'MulterError') {
        return new AppError(400, 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ใหม่', 'UPLOAD_ERROR');
    }
    if (error.type === 'entity.parse.failed') {
        return new AppError(400, 'รูปแบบ JSON ไม่ถูกต้อง', 'INVALID_JSON');
    }
    if (error.message === 'Origin is not allowed by CORS') {
        return new AppError(403, 'โดเมนนี้ไม่ได้รับอนุญาตให้เรียกใช้งาน API', 'CORS_ORIGIN_DENIED');
    }
    if (error.code === '23505') {
        return new AppError(409, 'ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว', 'DUPLICATE_DATA');
    }
    if (error.code === '23503') {
        return new AppError(409, 'รายการนี้ถูกใช้งานอยู่ จึงไม่สามารถลบหรือเปลี่ยนได้', 'REFERENCE_CONFLICT');
    }
    if (error.code === '55P03') {
        return new AppError(409, 'ข้อมูลรายการนี้กำลังถูกใช้งานอยู่ กรุณาลองใหม่อีกครั้ง', 'RESOURCE_LOCKED');
    }
    if (error.code === '57014') {
        return new AppError(503, 'คำสั่งฐานข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง', 'DATABASE_STATEMENT_TIMEOUT');
    }
    if (error.code === '40P01') {
        return new AppError(409, 'พบการล็อกข้อมูลชนกัน กรุณาลองใหม่อีกครั้ง', 'DATABASE_DEADLOCK');
    }
    if (error.code === '40001') {
        return new AppError(409, 'ข้อมูลถูกแก้ไขพร้อมกัน กรุณาลองใหม่อีกครั้ง', 'DATABASE_SERIALIZATION_FAILURE');
    }
    if (error.code === '42703') {
        return new AppError(
            503,
            'ฐานข้อมูลยังไม่ตรงกับระบบเวอร์ชันปัจจุบัน กรุณารัน Migration ให้ครบก่อนสร้างเอกสาร',
            'DOCUMENT_SCHEMA_OUTDATED'
        );
    }
    if (error.message === 'DISCOUNT_EXCEEDS_SUBTOTAL') {
        return new AppError(400, 'ส่วนลดต้องไม่มากกว่ายอดรวม', 'INVALID_DISCOUNT');
    }
    if (error.message === 'WITHHOLDING_EXCEEDS_TOTAL') {
        return new AppError(400, 'ยอดหัก ณ ที่จ่ายต้องไม่มากกว่ายอดรวม', 'INVALID_WITHHOLDING_AMOUNT');
    }
    if (error.message === 'PAYMENT_DEDUCTIONS_EXCEED_TOTAL') {
        return new AppError(400, 'ยอดหัก ณ ที่จ่ายและค่าธรรมเนียมรวมกันต้องไม่มากกว่ายอดรวม', 'INVALID_PAYMENT_DEDUCTIONS');
    }
    return error;
}

function errorHandler(error, req, res, _next) {
    const normalized = mapKnownError(error);
    const status = normalized.statusCode || normalized.status || 500;
    const isServerError = status >= 500;

    const logMeta = {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: status,
        code: normalized.code || 'INTERNAL_ERROR',
        message: normalized.message,
        stack: isServerError ? normalized.stack : undefined
    };

    if (isServerError) logger.error('request.error', logMeta);
    else logger.warn('request.rejected', logMeta);

    res.status(status).json({
        error: {
            code: normalized.code || 'INTERNAL_ERROR',
            message: isServerError ? 'ระบบเกิดข้อผิดพลาด กรุณาลองใหม่' : normalized.message,
            requestId: req.requestId,
            details: normalized.details
        }
    });
}

module.exports = { notFound, errorHandler };
