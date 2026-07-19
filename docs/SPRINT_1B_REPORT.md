# Sprint 1B Report - Backend Hardening

## Scope

Sprint 1B focuses on operational hardening and safer production behavior after Sprint 1A.

## Files Changed

- `backend/server.js`
- `backend/.env.example`
- `backend/src/app.js`
- `backend/src/config/db.js`
- `backend/src/config/env.js`
- `backend/src/middleware/error-handler.js`
- `backend/src/middleware/request-context.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/utils/logger.js`
- `CHANGELOG.md`

## Improvements

### 1. Structured Logger

Added `backend/src/utils/logger.js`.

Benefits:

- JSON log output for easier production troubleshooting
- `LOG_LEVEL` support: `debug`, `info`, `warn`, `error`, `silent`
- Automatic redaction for sensitive keys such as password, token, secret, authorization and cookie

### 2. Request ID and Request Logging

Added `backend/src/middleware/request-context.js`.

Benefits:

- Every request now receives an `X-Request-Id`
- API responses include the same request id
- Error responses include `requestId`
- Logs can be traced per request

### 3. Error Handler Hardening

Updated `backend/src/middleware/error-handler.js`.

Benefits:

- Converts known errors to stable API error codes
- Handles malformed JSON as `INVALID_JSON`
- Handles CORS denial as `CORS_ORIGIN_DENIED`
- Logs 4xx and 5xx errors with request context
- Avoids leaking stack traces to API clients

### 4. Environment Validation Hardening

Updated `backend/src/config/env.js` and `.env.example`.

New variables:

- `TRUST_PROXY`
- `LOG_LEVEL`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `DATABASE_IDLE_TIMEOUT_MS`
- `REQUEST_BODY_LIMIT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX`

Production checks:

- Blocks placeholder `JWT_SECRET` in production
- Blocks localhost CORS origins in production

### 5. Security and Operations

Updated `backend/src/app.js` and `backend/server.js`.

Benefits:

- Uses env-driven rate limit configuration
- Adds `Referrer-Policy: no-referrer`
- Uses structured server startup/shutdown logs
- Logs `unhandledRejection` and `uncaughtException`
- Uses database timeout settings from env

## Validation Performed

Syntax check passed for:

- `backend/server.js`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `backend/src/config/db.js`
- `backend/src/middleware/error-handler.js`
- `backend/src/middleware/request-context.js`
- `backend/src/routes/auth.routes.js`
- `backend/src/utils/logger.js`

Command used:

```bash
node --check <file>
```

## Recommended Runtime Test

After extracting the ZIP:

```bash
cd backend
npm ci
npm test
npm start
```

Then test:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

## Next Sprint Recommendation

Sprint 1C should focus on service-layer safety:

- Database transactions
- Race condition prevention
- Query performance
- Audit log consistency
- Centralized service errors
