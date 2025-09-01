# Multi-stage build for production optimization
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY services/user-service/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy shared code
COPY shared/ ./shared/

# Copy source code
COPY services/user-service/src/ ./src/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S userservice -u 1001

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S userservice -u 1001

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R userservice:nodejs /app

# Switch to non-root user
USER userservice

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/app.js"]