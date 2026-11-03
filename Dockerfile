# syntax=docker/dockerfile:1

# =========================================================================
# Stage 1: Builder
# =========================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies required for Vite & esbuild)
RUN npm ci || npm install

# Copy all source files
# Note: Vite imports Markdown guides from docs/ via `?raw`, so docs/ must be copied
COPY . .

# Build frontend SPA (dist/) and bundle backend server (dist/server.cjs)
RUN npm run build

# =========================================================================
# Stage 2: Runtime Runner
# =========================================================================
FROM node:22-slim AS runner

WORKDIR /app

# Production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only to minimize image size and attack surface
COPY package.json package-lock.json* ./
RUN (npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts) && npm cache clean --force

# Copy compiled frontend and backend bundle from builder stage
COPY --from=builder /app/dist ./dist

# Copy optional runtime configs and data templates
COPY firebase-applet-config.json* firebase-blueprint.json* ./
COPY data ./data

# Ensure runtime directory and data folder are writable by non-root node user
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user for security best practices
USER node

# Expose default Cloud Run port
EXPOSE 8080

# Container healthcheck targeting Express /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.cjs"]
