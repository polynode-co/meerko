# Build from the repo root:  docker build -f apps/worker/Dockerfile .
# Sends due emails and scans for replies on a timer. Self-hosted installs run one (or more: it's safe);
# Meerko Cloud doesn't, its scheduler calls the API's /internal/tick instead.
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --prod --filter @meerko/worker...
COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/worker apps/worker

WORKDIR /repo/apps/worker
# Configuration (DATABASE_URL, GOOGLE_*, MEERKO_ENCRYPTION_KEY, MEERKO_PUBLIC_URL) comes from the environment,
# so this skips the `start` script, which reads the repo's .env file.
ENV NODE_ENV=production
USER node
CMD ["node_modules/.bin/tsx", "src/index.ts"]
