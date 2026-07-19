# Production Readiness Checklist

## 1. Install
```bash
cd backend
npm ci
npm run migrate
npm test
npm start
```

## 2. Environment
Set real production values:
```env
NODE_ENV=production
JWT_SECRET=<real-secret-at-least-32-characters>
JWT_EXPIRES_IN=7d
DATABASE_URL=<production-db>
DATABASE_SSL=true
CORS_ORIGINS=https://your-real-domain.example
LOG_LEVEL=info
```

## 3. Required QA
- Login and keep the system open longer than one workday
- Add customers and confirm auto code sequence
- Create QT, IN, BN, RC, DO documents
- Test private workflow:
  - IN → BN → RC
  - IN → RC → BN
- Confirm receipt cannot be duplicated
- Confirm Audit Log details are readable
- Confirm report graphs and tables match
- Confirm print/PDF fits A4 and document names are correct
- Confirm viewer/staff/admin permissions

## 4. Backup
```bash
cd backend
npm run backup
```

Restore only after confirming the target database can be overwritten:
```bash
npm run restore ../backups/<file>.json
```

## 5. Deploy
- Use PM2 with `ecosystem.config.cjs` or systemd
- Use Nginx reverse proxy from `deploy/nginx.example.conf`
- Configure HTTPS
- Restrict CORS to the real frontend domain
- Enable log rotation
