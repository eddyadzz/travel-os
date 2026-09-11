# Deployment Guide

This guide covers standing up a BoliFlow deployment for a client: infrastructure,
the Docker stack, domain + email, schema, and the readiness gate.

## 1. Server requirements

- **Minimum** for a single agency: 2 vCPU, 4 GB RAM, 40 GB SSD.
- **Comfortable** with a large catalogue + several years of history: 4 vCPU, 8 GB RAM.
- **OS**: any Linux with Docker Engine 24+ and Docker Compose v2.
- **Network**: a public IP, outbound HTTPS (email + supplier APIs), and the client
  domain pointed at it.
- **PostgreSQL**: bundled in `docker-compose.yml` (postgres:16). For managed
  PostgreSQL (RDS/Cloud SQL), point `DATABASE_URL` at it instead and drop the `db`
  service.

## 2. DNS records

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `travel.client.mv` | A | server IP | the client website |
| `*.oceanatlas.mv` | A | server IP | tenant subdomains (optional) |
| `mail` TXT (SPF/DKIM) | TXT | from Resend | email deliverability |

Confirm DNS propagation (`dig travel.client.mv`) before continuing.

## 3. SSL & reverse proxy

Put a reverse proxy in front of the app (container port 3000, host port 8080) and
terminate TLS.

Caddy (simplest — automatic HTTPS):

```caddyfile
travel.client.mv {
    reverse_proxy 127.0.0.1:8080
}
```

Nginx example:

```nginx
server {
    listen 443 ssl;
    server_name travel.client.mv;
    ssl_certificate /etc/letsencrypt/live/travel.client.mv/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/travel.client.mv/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

For tenant subdomains use a wildcard cert (`*.oceanatlas.mv`) with Let's Encrypt's
DNS-01 challenge.

## 4. PostgreSQL

- The Compose file provisions a local `postgres:16` with healthchecks.
- Credentials come from `.env` (`POSTGRES_USER/PASSWORD/DB`) and `DATABASE_URL`.
- The app connects via `DATABASE_URL=postgresql://user:pass@db:5432/boliflow` inside
  the Docker network (`db` is the service name).
- Schema is created by `prisma db push` (entrypoint) — no manual SQL needed.

## 5. Docker stack

The repository ships the deployment template:

```
Dockerfile                 multi-stage build (Nitro server)
docker-compose.yml         app + PostgreSQL
.env.example               configuration template
scripts/docker-entrypoint.sh  schema sync + seed on first boot
scripts/backup.sh          logical DB dump + app archives
scripts/update.sh          pull → build → schema sync → restart
```

Provision:

```bash
git clone <your-repo> boliflow && cd boliflow
cp .env.example .env        # fill in DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, TENANT_BASE_DOMAIN
docker compose up -d --build
docker compose exec app sh scripts/docker-entrypoint.sh
```

The app listens on `http://<host>:8080` (mapped to container port 3000).

## 6. Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `POSTGRES_USER/PASSWORD/DB` | yes | local Postgres service credentials |
| `RESEND_API_KEY` | for prod | outbound email provider key |
| `EMAIL_FROM` | for prod | sender address for all customer mail |
| `TENANT_BASE_DOMAIN` | no | base domain for tenant subdomains |
| `PORT` | no | container port (default 3000) |

## 7. Email

Set `RESEND_API_KEY` and `EMAIL_FROM=bookings@<client-domain>`.

- With a key: real emails are sent (customer portal, deposit reminders, supplier
  requests, daily reports, job-failure alerts).
- Without a key: the platform runs in **dev mode** — every email is created and logged
  as SENT but not delivered. Do not go live in this mode.

Verify sender domain in Resend before the client sends customer mail.

## 8. First boot

The entrypoint runs `prisma db push` (schema) and the seed (catalogue + base data).
Then from the running app:

1. Open `/deploy` and run **Environment validation**.
2. Apply the client's **branding** (logo, brand color, email sender) and set their
   **custom domain**.
3. Import the client's inventory (spreadsheet import or supplier portal).
4. Create an initial **backup**.
5. Run the **Client readiness check** — it must be green before go-live.

## 9. Readiness gate

`/deploy` → **First client — readiness check** verifies:

- Backup exists and verifies
- Email provider configured
- PWA installable (manifest, service worker, icon)
- Audit trail active
- Client branding applied
- Catalogue & data loaded
- Database reachable

The check returns a pass %, a per-item pass/fail grid, and the **blockers** that must
be resolved. The deployment is client-ready only when there are no blockers.

## 10. Updates

`scripts/update.sh` pulls the latest code, rebuilds, syncs the schema and restarts.
Always run `scripts/backup.sh` before an update.

## 11. Backups & restore

See the [Backup & Recovery Guide](backup-recovery-guide.md). Summary:

- In-app: create / verify / download / restore from `/deploy`.
- Script: `scripts/backup.sh` for a `pg_dump` + app archive (cron-friendly).
- Restore: in-app restore for master data; `psql` for a full database restore.

## 12. Monitoring

- **Health**: the container healthcheck pings `/`.
- **Jobs**: `/jobs` shows scheduled-job success rates and alerts.
- **Audit**: import history and booking events are always recorded.
- **Support**: `/deploy` → Support toolkit shows system info and downloads a
  diagnostics bundle (env summary, job history, readiness) for remote help.

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Site won't load | App not started / port conflict | `docker compose ps`; check `docker compose logs app` |
| 500 on first boot | Schema not synced | run `scripts/docker-entrypoint.sh` (or `prisma db push`) |
| Emails not arriving | No `RESEND_API_KEY` / domain unverified | set the key, verify the sender domain in Resend |
| `DATABASE_URL` errors | wrong credentials / service down | confirm `.env` matches the `db` service |
| Branding not applied | custom domain not set / cached | set the domain; hard-refresh the site |
| Readiness shows blockers | see the blocker list | resolve each item in `/deploy` |
| Jobs failing | transient error | check `/jobs` history; rerun with **Run now** |
| Can't reach app behind proxy | proxy not forwarding Host header | ensure `proxy_set_header Host $host` / Caddy reverse_proxy |
| Disk filling | backups + logs | rotate old backups to off-box storage; trim logs |