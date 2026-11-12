# syntax=docker/dockerfile:1
#
# One image for the API and the worker (same code, different command):
#   API:     node dist/main.js     (default)
#   worker:  node dist/worker.js
# Plus a "migrate" target that applies database migrations, then exits.
#
# Build:  docker build -t notifyhub .
# Used by docker/docker-compose.prod.yml — see docs/self-hosting.md.

FROM node:24-bookworm-slim AS base
WORKDIR /app

# ── All dependencies (incl. dev: TypeScript, Prisma CLI) ──
FROM base AS deps
# The Prisma CLI (generate, migrate) needs OpenSSL, which the slim image lacks.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# npm ci runs `prisma generate` (postinstall). It only needs DATABASE_URL to be
# set, not reachable — so a placeholder, used for this command only.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci

# ── Compile TypeScript → dist/ ──
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Migrations (one-off): needs the Prisma CLI, a dev dependency ──
FROM deps AS migrate
ENV NODE_ENV=production
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ── Production dependencies only ──
FROM base AS prod-deps
COPY package.json package-lock.json ./
# --ignore-scripts: skip `prisma generate` (the client is already compiled
# into dist/). Native modules (argon2) ship prebuilt binaries.
# --omit=optional: also skips the Prisma CLI + TypeScript (~150 MB), which
# npm marks "dev or optional" because @prisma/client lists them as optional
# peers. The app never uses them. (Also skips msgpackr's native speed-up;
# BullMQ falls back to plain JavaScript.)
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

# ── Final image: API / worker ──
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Never run as root.
USER node
EXPOSE 3000
# Docker's health check (the API): healthy when Postgres, Mongo and Redis are up.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]
