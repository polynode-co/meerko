# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
# The dashboard calls the Meerko API through the workspace SDK package.
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile --filter @meerko/web...
COPY packages/sdk packages/sdk
COPY apps/web apps/web
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @meerko/web build

FROM node:22-alpine
WORKDIR /app
# MEERKO_API_URL (the API's URL) must be set at runtime for the /app dashboard.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
