# ==========================================
# Multi-stage Dockerfile for Google Cloud Run
# ==========================================

# Stage 1: Build client and server bundles
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy application sources
COPY . .

# Build client and server bundles
RUN npm run build

# Stage 2: Minimal production runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built production assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.mjs ./server.mjs

# Cloud Run injects PORT (defaults to 8080)
EXPOSE 8080

# Run lightweight bundled production server
CMD ["node", "server.mjs"]

