# --- deps stage (production-only node_modules for the runtime image) -----
FROM node:24-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- build stage -----------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run js:build

# --- runtime stage -----------------------------------------------------------
FROM node:24-slim
WORKDIR /app

# ARGs re-declared here — Dockerfile ARG scope ends at the stage that follows a FROM,
# so a value passed at build time only reaches instructions in this stage if repeated.
ARG VERSION=0.0.0-dev
ARG REVISION=unknown

# poppler-utils provides both `pdftoppm` and `pdfinfo`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 1001 appuser

COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --chown=appuser:appuser package.json ./
COPY --chown=appuser:appuser VERSION ./

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

LABEL org.opencontainers.image.title="asset-dedup-pdf-page-extract" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION \
      org.opencontainers.image.source="https://codeberg.org/pimbay-svc/asset-dedup-pdf-page-extract"

ENV NODE_ENV=production
ENV PDFTOPPM_BIN=pdftoppm
ENV PDFINFO_BIN=pdfinfo

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=3s --retries=5 \
  CMD node dist/presentation/uds/healthcheck.js

CMD ["node", "dist/server.js"]
