# Backup & Recovery Guide

Backups protect the client's data and make deployments recoverable. BoliFlow provides
both an in-app toolkit and command-line scripts.

## 1. What a backup contains

The in-app backup captures the **master data** across 30 tables: tenants, users,
suppliers and contacts, contract rates, properties, rooms, rates, availability,
promotions/packages/allocations, leads, quotes, bookings, payments, confirmations,
documents, audit/automation logs, job history, export files and supplier channels.

The `scripts/backup.sh` additionally produces a **logical PostgreSQL dump** (`pg_dump`)
— the authoritative, database-level backup.

## 2. Creating a backup (in-app)

`/deploy` → **Backups** → **Create backup**.

A JSON archive is written to `data/backups/` and listed with size and date.
Create one at least weekly and before every update.

## 3. Verifying a backup

Click the **shield** button next to any backup in `/deploy`. Verification checks:

- The archive parses as valid JSON.
- Every table is present and every row has an `id`.

A backup that fails verification is flagged and must not be relied on.

## 4. Downloading & storing off-box

- Use the **download** button in `/deploy` to pull an archive.
- Store archives off the server (object storage / external disk) so a failed server
  does not lose the backups.
- `scripts/backup.sh` can be run from cron to automate `pg_dump` + archive collection.

## 5. Restoring

`/deploy` → **Restore** on a listed backup. Restore upserts every row by id:

- Existing records are updated; missing records are created.
- The backup is applied on top of the current database, so restoring onto a fresh
  deployment repopulates it, and restoring onto a running one refreshes master data.

For a full database restore (e.g. after a failed server), use the `pg_dump` output:

```bash
# create a fresh database, then:
psql "$DATABASE_URL" < backups/db-<timestamp>.sql
# boot the app, which syncs the schema
```

## 6. Disaster-recovery checklist

Before the client goes live, verify the full loop once:

1. Create a backup.
2. **Verify** it passes integrity.
3. Download it off the server.
4. Restore it into a fresh temporary database and confirm key counts
   (properties, bookings, payments) match.

Keep at least one week of backups. Rotate older archives to off-box storage.

## 7. Automation safety

The scheduled jobs write history (job runs, automation log, exports) but do **not**
delete data. Backup before updates and before any bulk import so a mistake can be
reverted.