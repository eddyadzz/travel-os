#!/bin/sh
# BoliFlow backup — dump the database + local backup archives.
# Run on the host:  ./scripts/backup.sh  (or a cron job).
set -e

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# 1. Logical database dump (the authoritative backup).
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db-$STAMP.sql"
  echo "Database dump -> $BACKUP_DIR/db-$STAMP.sql"
else
  echo "pg_dump not found — install postgresql-client or back up via the /deploy UI instead."
fi

# 2. Application backup archives written by the /deploy toolkit live under ./data/backups.
if [ -d data/backups ] && [ -n "$(ls -A data/backups 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/app-$STAMP.tgz" -C data backups
  echo "App backups -> $BACKUP_DIR/app-$STAMP.tgz"
fi

echo "Done. Test a restore from these files before the client goes live."