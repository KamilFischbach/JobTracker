# Production image of the API. Build from the repository root:
#   docker build -f server/Dockerfile .
# On start it applies pending migrations, then runs the compiled server.

FROM node:22-alpine AS build
RUN npm install --global pnpm@12.8.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter server
COPY server server
# generate does not connect; the config only needs DATABASE_URL to be set.
RUN DATABASE_URL=postgresql://build@localhost/build \
    pnpm --filter server exec prisma generate --config prisma7.config.ts \
 && pnpm --filter server build \
 && pnpm --filter server deploy --prod --legacy /out \
 && cp -r server/dist server/prisma server/prisma7.config.ts /out/

FROM node:22-alpine
# NODE_ENV stays unset (development rules in config.ts): this image is for
# running locally over http://localhost, see compose.prod.yaml.
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# exec replaces the shell, so node receives docker's SIGTERM directly.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --config prisma7.config.ts && exec node dist/index.js"]
