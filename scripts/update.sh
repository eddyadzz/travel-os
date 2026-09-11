#!/bin/sh
# BoliFlow update — pull the new image, run schema sync, restart.
# Run on the host:  ./scripts/update.sh
set -e

echo "== Pulling latest =="
git pull --ff-only || true

echo "== Rebuilding image =="
docker compose build app

echo "== Syncing schema =="
docker compose run --rm app npx prisma db push --skip-generate

echo "== Restarting =="
docker compose up -d --no-deps app

echo "== Done. Run ./scripts/backup.sh first next time =="