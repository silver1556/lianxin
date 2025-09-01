const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Device-ID",
      "X-App-Version",
    ],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Global Rate limiting
if (process.env.RATE_LIMIT_ENABLED !== "false") {
  const globalRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
    message: {
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalRateLimit);
}

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();

  logger.info("Incoming request", {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  });

  next();
});

// Body parsing middleware (skip multipart/form-data)
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.startsWith("multipart/form-data")) {
    next(); // skip body parsing for files
  } else {
    express.json({ limit: "10mb" })(req, res, () => {
      express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
    });
  }
});

// Service URLs
const services = {
  userService: process.env.USER_SERVICE_URL || "http://localhost:3001",
  mediaService: process.env.MEDIA_SERVICE_URL || "http://localhost:3002",
  // Add other services here as they are implemented
  // postService: process.env.POST_SERVICE_URL || 'http://localhost:3002',
  // messageService: process.env.MESSAGE_SERVICE_URL || 'http://localhost:3003',
};

// Forward JSON and URL-encoded body in proxy
const forwardBody = (proxyReq, req) => {
  const contentType = req.headers["content-type"] || "";
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return;

  if (contentType.includes("application/json") && req.body) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader("Content-Type", "application/json");
    proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  } else if (
    contentType.includes("application/x-www-form-urlencoded") &&
    req.body
  ) {
    const bodyData = new URLSearchParams(req.body).toString();
    proxyReq.setHeader("Content-Type", "application/x-www-form-urlencoded");
    proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
  // multipart/form-data is streamed automatically
};

// Proxy creation helper
const createServiceProxy = (pathPrefix, targetService) =>
  createProxyMiddleware({
    target: targetService,
    changeOrigin: true,
    pathRewrite: (path) => path,
    onProxyReq: forwardBody,
    onError: (err, req, res) => {
      logger.error("Proxy error", {
        requestId: req.requestId,
        error: err.message,
      });
      res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: `${targetService}: Service unavailable`,
        },
        request_id: req.requestId,
      });
    },
  });

// Proxy routes
app.use(
  "/api/v1/auth",
  createServiceProxy("/api/v1/auth", services.userService)
);
app.use(
  "/api/v1/user",
  createServiceProxy("/api/v1/user", services.userService)
);
app.use(
  "/api/v1/media",
  createServiceProxy("/api/v1/media", services.mediaService)
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "api-gateway",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      services: Object.keys(services),
    },
    message: "Gateway is healthy",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
    timestamp: new Date().toISOString(),
    request_id: req.requestId,
  });
});

// Global error handler
app.use((err, req, res) => {
  const requestId = req.requestId || "unknown";

  logger.error("Gateway error", {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
    timestamp: new Date().toISOString(),
    request_id: requestId,
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    services: Object.keys(services),
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
