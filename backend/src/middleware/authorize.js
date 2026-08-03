const AppError = require('../utils/app-error');
const { hasPermission } = require('../utils/permissions');

const LEGACY_ROLES = new Set(['admin', 'staff', 'viewer']);

module.exports = (...allowed) => (req, _res, next) => {
    const user = req.user;
    if (!user) return next(new AppError(401, 'กรุณาเข้าสู่ระบบ', 'AUTH_REQUIRED'));
    if (!allowed.length) return next();

    const granted = allowed.some((rule) => {
        if (LEGACY_ROLES.has(rule)) return user.role === rule;
        return hasPermission(user, rule);
    });

    if (!granted) {
        return next(new AppError(403, 'คุณไม่มีสิทธิ์ทำรายการนี้', 'FORBIDDEN'));
    }
    return next();
};
