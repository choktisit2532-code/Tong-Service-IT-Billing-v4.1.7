const { z } = require('zod');

const booleanString = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true');

const optionalInteger = (schema, fallback) => z.preprocess(
    (value) => value == null || String(value).trim() === '' ? undefined : value,
    schema.default(fallback)
);

const nonEmptyCsv = z.string().transform((value) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: optionalInteger(z.coerce.number().int().min(1).max(65535), 3000),
    TRUST_PROXY: booleanString.default('false'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: booleanString.default('true'),
    DATABASE_SSL_REJECT_UNAUTHORIZED: booleanString.default('false'),
    DATABASE_POOL_MAX: optionalInteger(z.coerce.number().int().min(1).max(30), 5),
    DATABASE_CONNECTION_TIMEOUT_MS: optionalInteger(z.coerce.number().int().min(1000).max(60000), 15000),
    DATABASE_IDLE_TIMEOUT_MS: optionalInteger(z.coerce.number().int().min(1000).max(120000), 30000),
    TRANSACTION_STATEMENT_TIMEOUT_MS: optionalInteger(z.coerce.number().int().min(1000).max(120000), 30000),
    TRANSACTION_LOCK_TIMEOUT_MS: optionalInteger(z.coerce.number().int().min(100).max(30000), 5000),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGINS: nonEmptyCsv.default('http://localhost:5500,http://127.0.0.1:5500'),
    REQUEST_BODY_LIMIT: z.string().default('3mb'),
    RATE_LIMIT_WINDOW_MS: optionalInteger(z.coerce.number().int().min(1000).max(3600000), 15 * 60 * 1000),
    RATE_LIMIT_MAX: optionalInteger(z.coerce.number().int().min(1).max(5000), 700),
    LOGIN_RATE_LIMIT_WINDOW_MS: optionalInteger(z.coerce.number().int().min(60000).max(3600000), 15 * 60 * 1000),
    LOGIN_RATE_LIMIT_MAX: optionalInteger(z.coerce.number().int().min(1).max(100), 5),

    FEATURE_REALTIME: booleanString.default('false'),
    FEATURE_AUTOMATIC_BACKUP: booleanString.default('false'),
    FEATURE_EMAIL_NOTIFICATIONS: booleanString.default('false')
}).superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.includes('replace-with')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be a real production secret, not the placeholder from .env.example'
        });
    }

    if (value.NODE_ENV === 'production' && value.CORS_ORIGINS.some((origin) => origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CORS_ORIGINS'],
            message: 'Production CORS_ORIGINS should not include localhost origins'
        });
    }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
}

module.exports = {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    trustProxy: parsed.data.TRUST_PROXY,
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
    databaseSsl: parsed.data.DATABASE_SSL,
    databaseSslRejectUnauthorized: parsed.data.DATABASE_SSL_REJECT_UNAUTHORIZED,
    databasePoolMax: parsed.data.DATABASE_POOL_MAX,
    databaseConnectionTimeoutMs: parsed.data.DATABASE_CONNECTION_TIMEOUT_MS,
    databaseIdleTimeoutMs: parsed.data.DATABASE_IDLE_TIMEOUT_MS,
    transactionStatementTimeoutMs: parsed.data.TRANSACTION_STATEMENT_TIMEOUT_MS,
    transactionLockTimeoutMs: parsed.data.TRANSACTION_LOCK_TIMEOUT_MS,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
    corsOrigins: parsed.data.CORS_ORIGINS,
    requestBodyLimit: parsed.data.REQUEST_BODY_LIMIT,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.data.RATE_LIMIT_MAX,
    loginRateLimitWindowMs: parsed.data.LOGIN_RATE_LIMIT_WINDOW_MS,
    loginRateLimitMax: parsed.data.LOGIN_RATE_LIMIT_MAX,
    features: {
        realtime: parsed.data.FEATURE_REALTIME,
        automaticBackup: parsed.data.FEATURE_AUTOMATIC_BACKUP,
        emailNotifications: parsed.data.FEATURE_EMAIL_NOTIFICATIONS
    }
};
