# syntax=docker/dockerfile:1

# ── Base ─────────────────────────────────────────────────────────────────────
# Node 22 is required for the built-in node:sqlite module (see db/client.js).
FROM node:22-slim AS base
WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The SQLite DB lives here — mount a volume at this path so data survives
# container restarts/redeploys (see docker-compose.yml).
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Runs as an unprivileged user rather than root.
RUN groupadd -r botuser && useradd -r -g botuser botuser \
    && chown -R botuser:botuser /app
USER botuser

# Default command runs the sharded bot process; docker-compose overrides
# this for the dashboard service.
CMD ["node", "shard.js"]
