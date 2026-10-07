# Build from the repo root:  docker build -f apps/api/Dockerfile .
# The API runs its TypeScript source through tsx (the code uses parameter properties,
# which Node's built-in type stripping doesn't support).
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
# The hosted MCP endpoint (/mcp) serves the same tools as the local MCP server, through the SDK.
COPY packages/mcp/package.json packages/mcp/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile --prod --filter @meerko/api...
COPY packages/core packages/core
COPY packages/db packages/db
COPY packages/mcp packages/mcp
COPY packages/sdk packages/sdk
COPY apps/api apps/api

WORKDIR /repo/apps/api
# Configuration (DATABASE_URL, MEERKO_* and the provider keys) comes from the environment.
ENV NODE_ENV=production PORT=8080
# The deployed commit: PostHog's $release and $mcp_server_build (set by Cloud Build).
ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA
USER node
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "src/server.ts"]
