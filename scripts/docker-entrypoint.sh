#!/bin/sh
# One-shot entrypoint for a fresh container: sync the schema and seed the base data.
set -e
cd /app
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
exec "$@"