# Web image: the built client served by Caddy, which also proxies /api/* to
# the API. Build from the repository root: docker build -f client/Dockerfile .

FROM node:22-alpine AS build
RUN npm install --global pnpm@12.8.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --filter client
COPY client client
# Optional: the Cloudflare Turnstile site key (public, baked into the bundle).
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN pnpm --filter client exec vite build
COPY docker/Caddyfile docker/csp-hash.mjs /tmp/
RUN sed "s|__THEME_SCRIPT_HASH__|$(node /tmp/csp-hash.mjs client/dist/index.html)|" \
      /tmp/Caddyfile > /tmp/Caddyfile.built

FROM caddy:2.10-alpine
COPY --from=build /tmp/Caddyfile.built /etc/caddy/Caddyfile
COPY --from=build /app/client/dist /srv
EXPOSE 8080
