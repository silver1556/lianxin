# Multi-stage build for Media Service
FROM node:18-alpine AS builder

# Install system dependencies for media processing
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    vips-dev \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY services/media-service/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY services/media-service/src/ ./src/
COPY shared/ ./shared/

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ffmpeg \
    imagemagick \
    vips \
    clamav \
    clamav-daemon \
    freshclam \
    curl \
    dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S mediaservice -u 1001 && \
    mkdir -p /app/logs /app/temp /app/uploads && \
    chown -R mediaservice:nodejs /app

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package*.json ./

# Initialize ClamAV
RUN freshclam --quiet

# Switch to non-root user
USER mediaservice

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/app.js"]