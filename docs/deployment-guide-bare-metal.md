# Deployment Guide — Bare Metal (nginx + PM2 + Cloudflare)

This guide matches the production stack used for every BoliFlow client deployment:

- **Codebase** lives in `~/apps/<app>` and is symlinked to `/var/www/<app>`.
- **PostgreSQL** runs natively on `localhost`.
- **nginx** terminates TLS with Cloudflare origin certificates in `/etc/nginx/ssl/`.
- **Node processes** run under **PM2**.

> There is also a Docker-based template (`docker-compose.yml`) — use this guide for
> bare-metal servers; use the Docker path only if a client requires containers.

---

## 1 · Architecture

```
Cloudflare (DNS + SSL "Full (strict)")
        ↓
nginx :443  (origin cert from /etc/nginx/ssl/)
        ↓
Node  :3000  (PM2 → node .output/server/index.mjs)
        ↓
PostgreSQL :5432  (localhost)
```

nginx only reverse-proxies — the app (TanStack Start / Nitro) serves the public site,
the API, and the static assets from its `.output` bundle.

---

## 2 · Directory layout

```bash
mkdir -p ~/apps
cd ~/apps
git clone <your-repo> boliflow            # one checkout per client, e.g. boliflow-clientname
# stable path under /var/www via symlink (as you already do):
sudo ln -s ~/apps/boliflow /var/www/boliflow
```

The app writes runtime data relative to the **real** path (`~/apps/boliflow`):

- uploaded files → `public/uploads/` (local fallback; `R2` when configured)
- backups → `data/backups/`

The symlink is just for tooling that expects `/var/www`; PM2 should use the real path.

---

## 3 · Prerequisites

- Node **22 LTS** (matches the Docker base image) and `npm`
- PostgreSQL **16** on localhost
- **PM2**: `npm install -g pm2`
- nginx + a Cloudflare account with the domain on it

---

## 4 · First-time install

```bash
cd ~/apps/boliflow

# 1. Dependencies + generated Prisma client
npm ci
npx prisma generate

# 2. Environment
cp .env.example .env
nano .env

# 3. Build (produces .output/)
npm run build

# 4. Database schema (+ optional seed for a demo/fresh install)
npx prisma db push
npx prisma db seed          # optional — base catalogue + demo data

# 5. Run under PM2 (see ecosystem below)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                 # ensure it starts on boot
```

---

## 5 · Environment variables (`.env`)

The app loads `.env` from the project root automatically (via `dotenv`).

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | `postgresql://user:pass@localhost:5432/boliflow` |
| `RESEND_API_KEY` | prod | leave empty to log emails instead of sending (dev mode) |
| `EMAIL_FROM` | prod | sender, e.g. `bookings@client.mv` |
| `TENANT_BASE_DOMAIN` | no | base domain for tenant subdomains, e.g. `oceanatlas.mv` |
| `PORT` | no | app port (default 3000; nginx proxies to this) |
| `R2_ACCOUNT_ID` | no | Cloudflare R2 — all five must be set to enable object storage |
| `R2_ACCESS_KEY_ID` | no | |
| `R2_SECRET_ACCESS_KEY` | no | |
| `R2_BUCKET` | no | |
| `R2_PUBLIC_URL` | no | public base URL bound to the bucket, e.g. `https://cdn.client.mv` |

Without the `R2_*` vars, uploads fall back to `public/uploads/` on the server.

---

## 6 · PM2 ecosystem file

Create `ecosystem.config.cjs` in the project root:

```js
module.exports = {
  apps: [
    {
      name: "boliflow",
      cwd: "/home/<user>/apps/boliflow",   // real path, NOT the /var/www symlink
      script: ".output/server/index.mjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      instances: 1,                        // single-instance (in-process scheduler)
      autorestart: true,
    },
  ],
};
```

> Keep `instances: 1`. The platform runs an in-process scheduler (background jobs),
> and it assumes a single Node process per deployment.

---

## 7 · nginx + Cloudflare origin certificate

Place the Cloudflare origin cert + key in `/etc/nginx/ssl/` (as you already do):

```
/etc/nginx/ssl/client.mv.pem
/etc/nginx/ssl/client.mv.key
```

Server block (`/etc/nginx/sites-available/boliflow`):

```nginx
server {
    listen 443 ssl http2;
    server_name travel.client.mv;

    ssl_certificate     /etc/nginx/ssl/client.mv.pem;
    ssl_certificate_key /etc/nginx/ssl/client.mv.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Cloudflare connects with the real client IP in CF-Connecting-IP
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    real_ip_header CF-Connecting-IP;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name travel.client.mv;
    return 301 https://$host$request_uri;
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/boliflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8 · Cloudflare settings

1. **DNS** — an `A` record for the domain pointing at the server (proxied/orange cloud).
2. **SSL/TLS → Full (strict)** — requires the origin cert in `/etc/nginx/ssl/`.
3. **Origin certificates** — generate one for `travel.client.mv` (and `*.client.mv` if
   you use tenant subdomains) and install it as above.

---

## 9 · Update procedure

```bash
cd ~/apps/boliflow
./scripts/backup.sh           # or: pg_dump (see backup guide)
git pull --ff-only
npm ci
npx prisma generate
npm run build
npx prisma db push            # schema drift only — safe, non-destructive
pm2 reload boliflow
```

The `/deploy` → **readiness check** after every update confirms backup, email, PWA,
audit trail, branding and data are all still green.

---

## 10 · Backup & restore

In-app (`/deploy` → Backups) for master data; `pg_dump` for a full database backup:

```bash
pg_dump "$DATABASE_URL" > ~/backups/boliflow-$(date +%Y%m%d-%H%M%S).sql
```

Restore:

```bash
psql "$DATABASE_URL" < ~/backups/boliflow-YYYYMMDD-HHMMSS.sql
```

See `docs/backup-recovery-guide.md` for the full procedure (including verification
and the restore drill you must run before go-live).

---

## 11 · Onboarding & go-live

After install, finish the deployment in the app:

1. `/onboard` — guided wizard (company → branding → email → import → suppliers → users → readiness → go live)
2. `/deploy` — environment validation, import templates, backups, support toolkit
3. `/deploy` → **Client readiness check** — must be green (no blockers) before launch

---

## 12 · Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `pm2 logs boliflow` shows a 500 on first boot | schema not synced | `npx prisma db push` |
| Emails not delivered | no `RESEND_API_KEY` | set it + verify the sender domain in Resend |
| Uploads go to `public/uploads`, not R2 | missing `R2_*` vars | add all five `R2_*` vars to `.env` |
| Site times out behind Cloudflare | nginx not proxying / port wrong | check `proxy_pass` matches `PORT`; `nginx -t` |
| "SSL error" from Cloudflare | wrong SSL mode | set **Full (strict)** + install the origin cert |
| `DATABASE_URL` errors | local Postgres not listening / wrong creds | `pg_isready`; confirm the URL |
| Jobs not running | multiple instances | keep `instances: 1` in PM2 |
| Branding/domain not applied | custom domain not set | set it in `/cms` → Branding and re-run readiness |
