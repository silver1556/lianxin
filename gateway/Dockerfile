# Multi-stage build for API Gateway
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY gateway/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY gateway/src/ ./src/

# Copy shared utilities
COPY shared/ ./shared/

# Production stage
FROM node:18-alpine AS production

# Install security updates and curl for health checks
# Create non-root user for security
# Create necessary directories and set permissions
RUN apk update && apk upgrade && apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001 && \
    mkdir -p /app/logs && \
    chown -R gateway:nodejs /app

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package*.json ./

# Switch to non-root user
USER gateway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]