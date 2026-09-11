# BoliFlow — single-instance production image.
# Multi-stage: build the TanStack Start / Nitro output, then run it on Node.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Only the compiled server + its package manifest are needed.
COPY --from=build /app/.output .output
COPY --from=build /app/.output/package.json package.json

# Local data (backups live under ./data/backups).
VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]