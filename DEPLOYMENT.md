# BizB Dashboard — Production Deployment Guide

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend       │     │    Backend API    │     │   MongoDB Atlas  │
│   (Vercel)       │────▶│   (Render/VPS)    │────▶│   (Cloud DB)     │
│                  │     │                   │     │                  │
│ app.domain.com   │     │ api.domain.com    │     │ cluster0.xxx.net │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 1. Prerequisites

- Node.js 20+ 
- MongoDB Atlas account (free tier works)
- GitHub account
- Vercel account (frontend hosting)
- Render account (backend hosting)
- Custom domain (optional)

---

## 2. MongoDB Atlas Setup

### Create Cluster
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (M0 Free Tier for start)
3. Choose region closest to your users (Mumbai/Singapore for India)

### Configure Access
1. **Database Access** → Add DB User with read/write permissions
2. **Network Access** → Add IP: `0.0.0.0/0` (allow all — Render uses dynamic IPs)
3. Copy connection string: `mongodb+srv://<user>:<pass>@cluster.xxx.mongodb.net/bizb`

### Enable Backups
1. Go to **Backup** tab → Enable continuous backup (M10+ plans)
2. Or use `mongodump` scheduled via cron for free tier

---

## 3. Backend Deployment (Render)

### Option A: Auto-deploy with render.yaml
1. Push code to GitHub
2. Connect repo to [Render](https://render.com)
3. It will detect `render.yaml` and auto-configure

### Option B: Manual Setup
1. Create new **Web Service** on Render
2. Connect GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci`
   - **Start Command**: `node index.js`
   - **Node Version**: 20

### Environment Variables (Render Dashboard)
```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bizb?retryWrites=true&w=majority
SESSION_EXPIRY_HOURS=8
CLIENT_URL=https://app.yourdomain.com
BUSY_EXPORT_DIR=./exports/busy
LOG_LEVEL=info
```

### Health Check
- Path: `/api/health`
- Expected response: `{ "status": "ok" }`

---

## 4. Frontend Deployment (Vercel)

### Setup
1. Import project on [Vercel](https://vercel.com)
2. Set **Root Directory**: `frontend`
3. Framework: Vite (auto-detected)

### Environment Variables (Vercel Dashboard)
```
VITE_API_URL=https://api.yourdomain.com/api
```

### Build Settings
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

---

## 5. Domain Configuration

### Frontend Domain (Vercel)
1. Go to Project Settings → Domains
2. Add `app.yourdomain.com`
3. Configure DNS: CNAME → `cname.vercel-dns.com`

### Backend Domain (Render)
1. Go to Service Settings → Custom Domains
2. Add `api.yourdomain.com`
3. Configure DNS: CNAME → `your-service.onrender.com`

### SSL
- Both Vercel and Render provide automatic SSL certificates
- No manual configuration needed

### DNS Records Example
```
Type    Name    Value                       TTL
A       @       76.76.21.21                 300
CNAME   app     cname.vercel-dns.com        300
CNAME   api     your-service.onrender.com   300
```

---

## 6. Post-Deployment Setup

### Seed Production Database
```bash
# From backend directory with production .env
npm run seed:prod
npm run seed:hsn
```

### Verify Deployment
```bash
# Health check
curl https://api.yourdomain.com/api/health

# Login test
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bizb.in","password":"ChangeMe@2026"}'
```

### Change Default Admin Password
1. Login with default credentials
2. Go to Settings → Change password immediately

---

## 7. CI/CD (GitHub Actions)

The `.github/workflows/deploy.yml` handles:
- Lint checks on PR
- Build verification
- Auto-deploy on push to `main`

### Required GitHub Secrets
```
VERCEL_TOKEN          - Vercel personal token
VERCEL_ORG_ID         - From .vercel/project.json
VERCEL_PROJECT_ID     - From .vercel/project.json
RENDER_DEPLOY_HOOK    - Render deploy hook URL
```

---

## 8. Monitoring

### Application Logs
- Backend logs are written to `backend/logs/` (combined.log, error.log)
- Render dashboard shows real-time logs
- Use `GET /api/health` for uptime monitoring

### Recommended Services (Optional)
- **Uptime**: UptimeRobot (free) — monitor `/api/health`
- **Error Tracking**: Sentry (free tier)
- **Analytics**: Vercel Analytics (built-in)

---

## 9. Backup Strategy

### Database
```bash
# Manual backup
mongodump --uri="mongodb+srv://..." --out=./backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb+srv://..." ./backup/20260507
```

### Automated Backups
- MongoDB Atlas M10+ has continuous backups
- For M0: Set up cron job with `mongodump`

---

## 10. Rollback Steps

### Frontend (Vercel)
1. Go to Deployments tab
2. Click on previous working deployment
3. Click "Promote to Production"

### Backend (Render)
1. Go to Events tab
2. Find last working deploy
3. Click "Rollback"

### Database
```bash
# Restore from backup
mongorestore --uri="mongodb+srv://..." --drop ./backup/YYYYMMDD
```

---

## 11. Security Checklist

- [x] Helmet security headers
- [x] CORS whitelist (only production domain)
- [x] Rate limiting (200 req/min global, 5/15min login)
- [x] MongoDB injection prevention (express-mongo-sanitize)
- [x] Input size limits (2MB)
- [x] Session-based auth (no JWT secrets to leak)
- [x] Password hashing (bcrypt)
- [x] XSS protection (Helmet)
- [x] Compression (gzip)
- [x] Error messages hidden in production
- [x] Graceful shutdown handling
- [ ] IP whitelist on MongoDB Atlas
- [ ] Enable 2FA on hosting accounts
- [ ] Regular dependency updates (`npm audit`)

---

## 12. Performance Checklist

- [x] Database indexes on all query fields
- [x] Connection pooling (maxPoolSize: 10)
- [x] Gzip compression
- [x] Frontend code splitting (lazy routes)
- [x] Vendor chunk separation (react, recharts, pdf)
- [x] CSS minification
- [x] Static file caching

---

## 13. Commands Reference

```bash
# Development
cd backend && npm run dev          # Start backend (watch mode)
cd frontend && npm run dev         # Start frontend (HMR)

# Production
cd backend && npm start            # Start backend
cd frontend && npm run build       # Build frontend

# Database
cd backend && npm run seed         # Seed dev data
cd backend && npm run seed:prod    # Seed production (admin + settings)
cd backend && npm run seed:hsn     # Seed HSN codes
cd backend && npm run reset-db -- --confirm  # Reset database (DESTRUCTIVE)
```
