const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function getConfiguredLevel() {
    const level = String(process.env.LOG_LEVEL || 'info').toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : 'info';
}

const configuredLevel = getConfiguredLevel();

function redact(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(redact);

    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
        if (/password|token|secret|authorization|cookie/i.test(key)) return [key, '[REDACTED]'];
        return [key, redact(entry)];
    }));
}

function write(level, message, meta = {}) {
    if (LEVELS[level] < LEVELS[configuredLevel]) return;

    const payload = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...redact(meta)
    };

    const line = JSON.stringify(payload);
    if (level === 'error') return console.error(line);
    if (level === 'warn') return console.warn(line);
    return console.log(line);
}

module.exports = {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta)
};
