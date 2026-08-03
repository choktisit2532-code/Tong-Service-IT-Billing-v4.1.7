const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const productRoutes = require('./routes/product.routes');
const documentRoutes = require('./routes/document.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportRoutes = require('./routes/report.routes');
const settingsRoutes = require('./routes/settings.routes');
const userRoutes = require('./routes/user.routes');
const backupRoutes = require('./routes/backup.routes');
const auditRoutes = require('./routes/audit.routes');
const healthRoutes = require('./routes/health.routes');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { requestContext, requestLogger } = require('./middleware/request-context');
const { version } = require('../package.json');

const app = express();
if (env.trustProxy || env.nodeEnv === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestContext);
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: false
}));

function originAllowed(origin) {
    if (!origin) return true;
    return env.corsOrigins.some((allowed) => {
        if (allowed === origin) return true;
        if (!allowed.includes('*')) return false;
        try {
            const allowedUrl = new URL(allowed.replace('*.', 'placeholder.'));
            const originUrl = new URL(origin);
            const suffix = allowedUrl.hostname.replace(/^placeholder\./, '');
            return originUrl.protocol === allowedUrl.protocol
                && originUrl.hostname.endsWith(`.${suffix}`);
        } catch {
            return false;
        }
    });
}

app.use(cors({
    origin(origin, callback) {
        if (originAllowed(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: false
}));

app.use(express.json({ limit: env.requestBodyLimit, strict: true }));
app.use(rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'เรียกใช้งาน API ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
        }
    }
}));
app.use(requestLogger);

app.get('/', (_req, res) => res.json({ name: 'Tong Service IT Billing API', version }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/audit', auditRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
