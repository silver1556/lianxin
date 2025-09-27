# Lianxin Social Media Platform - User service Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Design Principles](#2-architecture--design-principles)
3. [Project Structure](#3-project-structure)
4. [File-by-File Documentation](#4-file-by-file-documentation)
5. [API Documentation](#5-api-documentation)
6. [File Dependencies & Connections](#6-file-dependencies--connections)
7. [Frontend Integration Strategy](#7-frontend-integration-strategy)
8. [Development Workflow](#8-development-workflow)
9. [Deployment & Operations](#9-deployment--operations)
10. [Security & Compliance](#10-security--compliance)

---

## 1. Project Overview

**Lianxin** is a comprehensive social media platform designed specifically for the Chinese market, built with a microservices architecture. The platform emphasizes security, compliance with Chinese regulations (PIPL, Cybersecurity Law, Data Security Law), and scalability. This documentation is only for **user service**.

### User service Key Features
- **User Management**: Registration, authentication, profile management
- **Security**: Military-grade encryption, JWT authentication, comprehensive audit logging, "field-level encryption" and "enhanced session management".
- **Compliance**: PIPL, Cybersecurity Law, and Data Security Law compliance
- **Scalability**: Microservices architecture with Redis caching and MySQL database
- **Admin Controls**: Comprehensive administrative interface for user management

### Technology Stack
- **Backend**: Node.js, Express.js, MySQL, Redis
- **Authentication**: JWT with refresh token rotation
- **Encryption**: AES-256-GCM field-level encryption
- **Validation**: Joi schemas with express-validator
- **ORM**: Sequelize
- **Containerization**: Docker with multi-stage builds
- **Monitoring**: Winston/Bunyan logging with structured JSON

---

## 2. Architecture & Design Principles

### 2.1 Microservices Architecture
The platform is designed as a collection of loosely coupled, independently deployable services:
- **User Service**: Authentication, profile management, settings
- **Social Service**: (Future) Friend relationships, social interactions
- **Content Service**: (Future) Posts, media, content management
- **Notification Service**: (Future) Push notifications, alerts
- **Media Service**: (Future) File storage, image processing

### 2.2 Monorepo Structure
All services reside in a single repository for:
- **Code Sharing**: Common utilities, libraries, and schemas
- **Dependency Management**: Centralized package management
- **Consistency**: Unified coding standards and practices
- **Simplified CI/CD**: Single pipeline for all services

### 2.3 Security-First Design
- **Field-Level Encryption**: Sensitive PII encrypted at rest
- **JWT Authentication**: Stateless authentication with refresh rotation
- **Rate Limiting**: Multi-tier rate limiting to prevent abuse
- **Audit Logging**: Comprehensive activity tracking for compliance
- **Input Validation**: Multi-layer validation with sanitization

### 2.4 China Compliance
- **PIPL Compliance**: Personal Information Protection Law adherence
- **Cybersecurity Law**: Security incident tracking and reporting
- **Data Security Law**: Data classification and protection
- **Content Moderation**: Built-in content filtering capabilities

---

## 3. Project Structure

```
lianxin/
├── index.js                                    # Root Node.js demo file
├── package.json                               # Root package configuration
├── docker-compose.yml                         # Complete orchestration file with user-service, MySQL, Redis, and Adminer
├── .env                                      # environment configuration
├── .env.example                               # environment template
├── docker-compose.dev.yml                     # Development overrides with hot reloading
├── docker-compose.prod.yml                     # Production optimizations
├── .dockerignore                              # Optimized Docker build context
├── Makefile                                  # Convenient commands for development
├── LIANXIN_PROJECT_DOCUMENTATION.md          # This documentation file
├── services/                                  # Microservices directory
│   └── user-service/                         # User management microservice
│       ├── Dockerfile                        # Container configuration
│       ├── .env.example                     # Environment variables template
│       ├── package.json                     # Service-specific dependencies
│       ├── README.md                        # User Service documentation
│       ├── db/                               # Database management
│       │   └── migrations/                         # Database schema migrations
│       │       ├── YYYYMMDDHHMMSS_users.sql # Users table creation
│       │       ├── YYYYMMDDHHMMSS_user_sessions.sql  # User sessions table
│       │       ├── YYYYMMDDHHMMSS_otp_verifications.sql # OTP verifications table
│       │       ├── YYYYMMDDHHMMSS_user_settings.sql  # User settings table
│       │       └── YYYYMMDDHHMMSS_audit_logs.sql  # Audit logs table
│       ├── seeds/                           # Database seed data
│       │   ├── 001_demo_users.js           # Demo user accounts
│       │   ├── 002_demo_user_settings.js    # Demo user settings
│       │   ├── 003_demo_user_sessions.js    # Demo user sessions
│       │   ├── 004_demo_otp_verifications.js    # Demo otp verifications
│       │   └── 005_demo_audit_logs.js         # Demo audit log
│       └── src/                             # Source code
│           ├── app.js                       # Application entry point
│           ├── config/                      # Configuration files
│           │   ├── alibaba-sms.config.js   # SMS service configuration
│           │   ├── app.config.js           # Application settings
│           │   ├── database.config.js      # Database connection config
│           │   ├── redis.config.js         # Redis cache configuration
│           │   └── security.config.js      # Security settings
│           ├── controllers/                 # API route handlers
│           │   ├── admin/                   # Admin-specific controllers
│           │   │   ├── admin.controller.js # User management admin APIs
│           │   │   └── compliance.controller.js # Compliance admin APIs
│           │   ├── auth.controller.js       # Authentication APIs
│           │   ├── profile.controller.js    # User profile APIs
│           │   ├── session.controller.js    # Session management APIs
│           │   └── settings.controller.js   # User settings APIs
│           ├── errors/                      # Custom error classes
│           │   ├── AppError.js             # Base application error
│           │   ├── authError.js            # Authentication errors
│           │   └── validationError.js      # Validation errors
│           ├── jobs/                        # Background tasks
│           │   ├── account-deletion.job.js # Account cleanup job
│           │   └── otp-cleanup.job.js      # OTP cleanup job
│           ├── middleware/                  # Express middleware
│           │   ├── audit.middleware.js     # Activity logging
│           │   ├── auth.middleware.js      # Authentication/authorization
│           │   ├── encryption.middleware.js # Data encryption
│           │   ├── rate-limit.middleware.js # Rate limiting
│           │   └── validation.middleware.js # Input validation
│           ├── models/                      # Database models (Sequelize)
│           │   ├── audit.model.js          # Audit log model
│           │   ├── index.js                # Model initialization
│           │   ├── otp.model.js            # OTP verification model
│           │   ├── session.model.js        # User session model
│           │   ├── settings.model.js       # User settings model
│           │   └── user.model.js           # User account model
│           ├── schemas/                     # Validation schemas (Joi)
│           │   ├── auth.schema.js          # Authentication validation
│           │   ├── settings.schema.js      # Settings validation
│           │   └── user.schema.js          # User data validation
│           ├── services/                    # Business logic layer
│           │   ├── admin.service.js        # Admin operations
│           │   ├── auth.service.js         # Authentication logic
│           │   ├── compliance.service.js   # Compliance reporting
│           │   ├── encryption.service.js   # Data encryption
│           │   ├── otp.service.js          # OTP management
│           │   ├── cloud-storage.service.js          # cloud storage for file uploads
│           │   ├── profile.service.js      # Profile management
│           │   ├── session.service.js      # Session management
│           │   └── settings.service.js     # Settings management
│           └── utils/                       # Utility functions
│               ├── encryption.util.js      # Cryptographic utilities
│               ├── jwt.util.js             # JWT token utilities
│               ├── logger.util.js          # Service-specific logging
│               ├── password.util.js        # Password utilities
│               ├── phone.util.js           # Phone number utilities
│               └── validation.util.js      # Validation utilities
└── shared/                                  # Shared libraries and utilities
    ├── libraries/                          # Reusable libraries
    │   ├── auth/                           # Authentication libraries
    │   │   └── jwt.strategy.js            # JWT verification strategy
    │   ├── cache/                          # Caching libraries
    │   │   └── redis.client.js            # Redis client manager
    │   ├── database/                       # Database libraries
    │   │   └── mysql.pool.js              # MySQL connection pool
    │   └── logging/                        # Logging libraries
    │       └── logger.js                  # Platform-wide logger
    └── utils/                              # Shared utilities
        └── api.response.js                # Standardized API responses

```

---

## 4. File-by-File Documentation

### 4.1 Root Level Files

#### `package.json` (Root)
**Purpose**: Root package configuration for the monorepo.
**Dependencies**: None
**Role**: Monorepo coordination and workspace management

### 4.2 User Service Files

#### Entry Point

##### `services/user-service/src/app.js`
**Purpose**: Main application entry point and Express.js server setup.

**Key Responsibilities**:
- Express application initialization
- Middleware configuration (security, CORS, compression, rate limiting)
- Route mounting and API versioning
- Error handling setup
- Database and Redis connection management
- Background job initialization
- Graceful shutdown handling

**Dependencies**:
```javascript
// External
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Internal Configuration
const appConfig = require('./config/app.config');
const databaseConfig = require('./config/database.config');
const redisConfig = require('./config/redis.config');

// Utilities
const logger = require('./utils/logger.util');
const { AppError } = require('./errors/AppError');

// Middleware
const authMiddleware = require('./middleware/auth.middleware');
const validationMiddleware = require('./middleware/validation.middleware');
const rateLimitMiddleware = require('./middleware/rate-limit.middleware');
const encryptionMiddleware = require('./middleware/encryption.middleware');
const auditMiddleware = require('./middleware/audit.middleware');

// Controllers
const authController = require('./controllers/auth.controller');
const profileController = require('./controllers/profile.controller');
const settingsController = require('./controllers/settings.controller');
const sessionController = require('./controllers/session.controller');
const adminController = require('./controllers/admin/admin.controller');
const complianceController = require('./controllers/admin/compliance.controller');

// Shared
const apiResponse = require('../../shared/utils/api.response');
const mysqlPool = require('../../shared/libraries/database/mysql.pool');
const redisClient = require('../../shared/libraries/cache/redis.client');
```

**Exports**: `userServiceApp` class instance

**API Routes Mounted**:
- `/api/v1/auth` → `authController`
- `/api/v1/user` → `profileController`, `settingsController`, `sessionController`
- `/api/v1/admin` → `adminController`, `complianceController`

#### Configuration Files (`src/config/`)

##### `services/user-service/src/config/app.config.js`
**Purpose**: Application-wide configuration settings.

**Configuration Categories**:
- Server settings (port, environment, service name)
- API configuration (prefix, allowed origins)
- Security settings (CORS, Helmet)
- Rate limiting configuration
- File upload settings
- Pagination defaults
- Session management
- OTP settings
- Account management
- China compliance flags
- Feature flags
- External service URLs

**Dependencies**: `dotenv` for environment variable loading
**Used By**: `app.js`, various services and middleware
**Environment Variables**: Reads from process.env with sensible defaults

##### `services/user-service/src/config/database.config.js`
**Purpose**: MySQL database connection configuration for different environments.

**Configuration Environments**:
- Development: Local MySQL with debug logging
- Test: Isolated test database
- Production: SSL-enabled, optimized connection pooling

**Key Settings**:
- Connection parameters (host, port, credentials)
- Sequelize dialect options
- Connection pooling configuration
- SSL/TLS settings
- Retry mechanisms
- Health check configuration

**Dependencies**: `dotenv`
**Used By**: `src/models/index.js`, `shared/libraries/database/mysql.pool.js`

##### `services/user-service/src/config/redis.config.js`
**Purpose**: Redis cache and session store configuration.

**Configuration Categories**:
- Connection settings (host, port, password, DB)
- Cluster configuration
- Cache strategies (write-through, cache-aside)
- TTL settings for different data types
- Compression and serialization
- Health monitoring
- Performance optimization

**Dependencies**: `dotenv`
**Used By**: `shared/libraries/cache/redis.client.js`, `src/middleware/rate-limit.middleware.js`

##### `services/user-service/src/config/security.config.js`
**Purpose**: Comprehensive security configuration, serving as the single source of truth for all security and many application-level settings.

**Security Domains**:
- JWT configuration (secrets, expiry, algorithms)
- Password policy (complexity, history, lockout)
- Encryption settings (algorithms, keys, fields)
- Session security (timeout, validation, fingerprinting)
- OTP security (length, expiry, rate limiting)
- Rate limiting rules
- CORS and CSP configuration
- Security headers
- Audit and compliance settings

**Dependencies**: `dotenv`, `crypto`
**Used By**: All security-related utilities and middleware

##### `services/user-service/src/config/alibaba-sms.config.js`
**Purpose**: Alibaba Cloud SMS service (for OTP) configuration.

**Configuration Areas**:
- Access credentials and endpoints
- SMS templates for different OTP types
- Rate limiting and retry mechanisms
- Monitoring and alerting
- Fallback providers
- Development/testing settings
- Performance optimization

**Dependencies**: `dotenv`
**Used By**: `src/services/otp.service.js` (currently mocked)

#### Controllers (`src/controllers/`)

Controllers handle HTTP requests, validate input, delegate to services, and format responses.

##### `services/user-service/src/controllers/auth.controller.js`
**Purpose**: Authentication API endpoints.

**Endpoints**:
- `POST /register/otp` - Request registration OTP
- `POST /register` - User registration
- `POST /login/otp` - Request login OTP  
- `POST /login` - User login (password or OTP)
- `POST /refresh` - Token refresh
- `POST /logout` - User logout
- `POST /forgot-password/otp` - Request password reset OTP
- `POST /reset-password` - Password reset

**Dependencies**:
```javascript
const authService = require('../services/auth.service');
const otpService = require('../services/otp.service');
const validationUtil = require('../utils/validation.util');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');
```

**Validation**: Uses `express-validator` and `validationUtil`
**Rate Limiting**: Applied per endpoint type
**Error Handling**: Converts service errors to HTTP responses

##### `services/user-service/src/controllers/profile.controller.js`
**Purpose**: User profile management API endpoints.

**Endpoints**:
- `GET /profile` - Get own profile
- `PUT /profile` - Update profile
- `POST /avatar` - Upload avatar
- `POST /cover-photo` - Upload cover photo
- `GET /public/:userId` - Get public user profile

**Dependencies**:
```javascript
const profileService = require('../services/profile.service');
const authMiddleware = require('../middleware/auth.middleware');
const multer = require('multer'); // File upload handling
```

**File Upload**: Configured multer for image uploads (JPEG, PNG, WebP)
**Authentication**: All endpoints require valid JWT
**Validation**: File type and size validation

##### `services/user-service/src/controllers/session.controller.js`
**Purpose**: Session management API endpoints.

**Endpoints**:
- `GET /sessions` - List active sessions
- `DELETE /sessions/:sessionId` - Revoke specific session
- `POST /sessions/revoke-all` - Revoke all other sessions
- `GET /sessions/stats` - Session statistics
- `GET /sessions/device-trust/:deviceId` - Check device trust
- `GET /sessions/device/:deviceId` - Get device sessions

**Dependencies**:
```javascript
const sessionService = require('../services/session.service');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');
```

**Security**: Password required for session revocation
**Rate Limiting**: Prevents session manipulation abuse

##### `services/user-service/src/controllers/settings.controller.js`
**Purpose**: User settings and account management API endpoints.

**Endpoints**:
- `GET /settings` - Get user settings
- `PUT /settings` - Update settings
- `PUT /password-change` - Change password
- `POST /phone/otp` - Request phone change OTP
- `PUT /phone-number-change` - Change phone number
- `POST /deactivate` - Deactivate account
- `POST /request-deletion` - Request account deletion

**Dependencies**:
```javascript
const settingsService = require('../services/settings.service');
const validationUtil = require('../utils/validation.util');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');
```

**Security**: Critical operations require password confirmation
**Validation**: Comprehensive settings validation with Joi schemas

#### Admin Controllers (`src/controllers/admin/`)

##### `services/user-service/src/controllers/admin/admin.controller.js`
**Purpose**: Administrative user management endpoints.

**Endpoints**:
- `GET /users` - List users with filters
- `GET /users/:userId` - Get user details by userID
- `POST /users/:userId/suspend` - Suspend user
- `POST /users/:userId/unsuspend` - Unsuspend user
- `POST /users/:userId/verify` - Verify user
- `GET /stats` - User statistics
- `GET /users/search` - Advanced user search by Name or Display name

**Dependencies**:
```javascript
const adminService = require('../../services/admin.service');
const authMiddleware = require('../../middleware/auth.middleware');
const auditMiddleware = require('../../middleware/audit.middleware');
```

**Authorization**: Requires admin role
**Audit Logging**: All admin actions are logged
**Rate Limiting**: Admin-specific rate limits

##### `services/user-service/src/controllers/admin/compliance.controller.js`
**Purpose**: Compliance and audit management endpoints.

**Endpoints**:
- `GET /audit-logs` - Retrieve audit logs
- `GET /users/:userId/audit` - User audit trail
- `POST /compliance/report` - Generate compliance reports
- `GET /users/:userId/data-export` - Export user data
- `GET /compliance/stats` - Compliance statistics
- `GET /security/events` - Security events

**Dependencies**:
```javascript
const complianceService = require('../../services/compliance.service');
const authMiddleware = require('../../middleware/auth.middleware');
const auditMiddleware = require('../../middleware/audit.middleware');
```

**Compliance**: PIPL, Cybersecurity Law, Data Security Law reporting
**Data Export**: GDPR-style data portability
**Security Monitoring**: Security event tracking

#### Error Classes (`src/errors/`)

##### `services/user-service/src/errors/AppError.js`
**Purpose**: Base custom error class for consistent error handling.

**Features**:
- Extends native Error class
- Adds statusCode, errorCode, details properties
- Provides static methods for common HTTP errors
- Includes timestamp and operational flag
- JSON serialization support

**Static Methods**:
- `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`
- `conflict()`, `unprocessableEntity()`, `rateLimitExceeded()`
- `internalServerError()`, `serviceUnavailable()`

**Used By**: All services and middleware for throwing structured errors

##### `services/user-service/src/errors/authError.js`
**Purpose**: Authentication-specific error class.

**Features**:
- Extends AppError
- Adds attempt tracking details
- Provides auth-specific static methods

**Static Methods**:
- `invalidCredentials()`, `accountLocked()`, `accountSuspended()`
- `invalidToken()`, `expiredToken()`, `missingToken()`
- `invalidOTP()`, `expiredOTP()`, `otpMaxAttempts()`
- `insufficientPermissions()`, `sessionNotFound()`

**Used By**: Authentication services and middleware

##### `services/user-service/src/errors/validationError.js`
**Purpose**: Validation-specific error class with field-level details.

**Features**:
- Extends AppError
- Maintains array of field-specific validation errors
- Provides validation-specific static methods

**Static Methods**:
- `requiredField()`, `invalidFormat()`, `invalidLength()`
- `duplicateValue()`, `outOfRange()`, `invalidType()`
- `invalidPhoneNumber()`, `invalidPassword()`, `invalidOTP()`

**Used By**: Validation utilities and middleware

#### Background Jobs (`src/jobs/`)

##### `services/user-service/src/jobs/account-deletion.job.js`
**Purpose**: Automated account deletion after grace period.

**Functionality**:
- Scheduled daily execution (3 AM)
- Identifies accounts pending deletion past grace period (15 days)
- Permanently deletes user data with audit logging
- Provides manual execution and statistics

**Dependencies**:
```javascript
const cron = require('node-cron');
const { User, UserSession, UserSettings, AuditLog } = require('../models');
```

**Database Operations**: Cascading deletion with transaction support
**Audit Trail**: Logs all deletion activities for compliance

##### `services/user-service/src/jobs/otp-cleanup.job.js`
**Purpose**: Automated OTP record cleanup.

**Functionality**:
- Scheduled execution every 10 minutes (expired OTPs)
- Daily cleanup of verified OTPs older than 90 days
- Provides statistics and manual execution

**Dependencies**:
```javascript
const cron = require('node-cron');
const { OtpVerification } = require('../models');
```

**Database Hygiene**: Prevents accumulation of old OTP records
**Performance**: Maintains optimal database performance

#### Middleware (`src/middleware/`)

##### `services/user-service/src/middleware/auth.middleware.js`
**Purpose**: JWT authentication and authorization middleware.

**Functions**:
- `authenticate()` - Verify JWT and session validity
- `requireAdmin()` - Enforce admin role requirement
- `requirePermission()` - Check specific permissions
- `optionalAuth()` - Optional authentication for public endpoints
- `requireOwnership()` - Ensure resource ownership
- `userRateLimit()` - User-specific rate limiting

**Dependencies**:
```javascript
const jwtUtil = require('../utils/jwt.util');
const sessionService = require('../services/session.service');
```

**Security Features**:
- JWT signature verification
- Session validation against Redis
- Role-based access control
- Permission-based access control
- Request context enrichment

##### `services/user-service/src/middleware/audit.middleware.js`
**Purpose**: Comprehensive activity logging for compliance.

**Functions**:
- `logActivity()` - General activity logging
- `logAuthEvent()` - Authentication event logging
- `logProfileChange()` - Profile modification logging
- `logSecurityEvent()` - Security event logging
- `logAdminAction()` - Administrative action logging

**Dependencies**:
```javascript
const { AuditLog } = require('../models');
```

**Compliance**: PIPL, Cybersecurity Law audit requirements
**Security**: Tracks all significant user and system actions

##### `services/user-service/src/middleware/encryption.middleware.js`
**Purpose**: Automatic data encryption/decryption middleware.

**Functions**:
- `encryptRequestData()` - Encrypt incoming sensitive data
- `decryptResponseData()` - Decrypt outgoing sensitive data
- `encryptFields()` - Encrypt specific fields
- `generateIntegrityHash()` - Data integrity verification
- `encryptFileData()` - File encryption support

**Dependencies**:
```javascript
const encryptionService = require('../services/encryption.service');
```

**Security**: Field-level encryption for PII protection
**Transparency**: Automatic encryption/decryption without service changes

##### `services/user-service/src/middleware/rate-limit.middleware.js`
**Purpose**: Multi-tier rate limiting protection.

**Rate Limit Types**:
- Global rate limiting (1000 req/hour)
- Authentication rate limiting (10 attempts/15min)
- Registration rate limiting (5 reg/hour)
- OTP rate limiting (5 OTP/5min)
- File upload rate limiting (5 uploads/min)
- Admin rate limiting (50 actions/min)

**Dependencies**:
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
```

**Storage**: Redis-backed for distributed rate limiting
**Flexibility**: Configurable limits per endpoint type

##### `services/user-service/src/middleware/validation.middleware.js`
**Purpose**: Request validation and sanitization.

**Functions**:
- `handleValidationErrors()` - Process express-validator results
- `sanitizeBody()` - Clean and sanitize request data
- `validatePhoneNumber()` - Phone number format validation
- `validatePasswordStrength()` - Password complexity validation
- `validateFileUpload()` - File upload validation
- `validateUUID()` - Validate UUID fields
- `validateJWTToken()` - Validate JWT token format
- `validateContent()` - Content moderation

**Dependencies**:
```javascript
const { validationResult } = require('express-validator');
const validationUtil = require('../utils/validation.util');
```

**Security**: Input sanitization and XSS prevention
**Data Quality**: Ensures clean, valid data reaches business logic

#### Database Models (`src/models/`)

##### `services/user-service/src/models/index.js`
**Purpose**: Sequelize ORM initialization and model coordination.

**Responsibilities**:
- Sequelize instance creation
- Database connection configuration
- Model imports and initialization
- Association definitions between models
- Database utility functions

**Model Associations**:
```javascript
// User has many sessions, OTPs, settings, audit logs
User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });
User.hasMany(OtpVerification, { foreignKey: 'user_id', as: 'otpVerifications' });
User.hasOne(UserSettings, { foreignKey: 'user_id', as: 'settings' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });

// Reverse associations
UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
OtpVerification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserSettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
```

**Exports**: All models and Sequelize utilities
**Used By**: All services requiring database access

##### `services/user-service/src/models/user.model.js`
**Purpose**: Core user account model definition.

**Schema Fields**:
- **Identity**: id, uuid, phone, country_code
- **Authentication**: password_hash, password_changed_at
- **Profile**: display_name, first_name, last_name, bio, avatar_url, etc.
- **Status**: phone_verified, is_verified, is_private, status
- **Tracking**: last_login, login_count, failed_login_attempts
- **Timestamps**: created_at, updated_at, deactivated_at

**Instance Methods**:
- `validatePassword()` - Compare password with hash
- `toSafeObject()` - Remove sensitive fields
- `toPublicObject()` - Public profile view
- `isAccountLocked()` - Check lockout status
- `canLogin()` - Validate login eligibility

**Class Methods**:
- `findByPhone()` - Find user by phone number
- `findByUuid()` - Find user by UUID

**Hooks**:
- `beforeCreate` - Hash password before saving
- `beforeUpdate` - Hash password on change

##### `services/user-service/src/models/session.model.js`
**Purpose**: User session tracking and management.

**Schema Fields**:
- **Identity**: id, user_id, session_id
- **Security**: refresh_token, expires_at, revoked_at
- **Tracking**: device_info, ip_address, user_agent, location
- **Status**: is_active

**Instance Methods**:
- `isExpired()` - Check expiration status
- `isRevoked()` - Check revocation status
- `isValid()` - Overall validity check
- `revoke()` - Mark session as revoked
- `toSafeObject()` - Remove sensitive data

**Class Methods**:
- `findBySessionId()` - Find by session identifier
- `findByRefreshToken()` - Find by refresh token
- `findActiveByUserId()` - Get user's active sessions
- `cleanupExpired()` - Remove expired sessions

##### `services/user-service/src/models/otp.model.js`
**Purpose**: OTP verification tracking and management.

**Schema Fields**:
- **Identity**: id, verification_id, user_id, phone
- **OTP Data**: otp_code, otp_type, country_code
- **Validation**: is_verified, attempts, max_attempts
- **Tracking**: ip_address, expires_at, verified_at

**Instance Methods**:
- `isExpired()` - Check expiration
- `isMaxAttemptsReached()` - Check attempt limit
- `canVerify()` - Overall verification eligibility
- `incrementAttempts()` - Track failed attempts
- `markAsVerified()` - Mark as successfully verified

**Class Methods**:
- `findByVerificationId()` - Find by verification ID
- `findActiveByPhone()` - Find active OTP for phone
- `cleanupExpired()` - Remove expired OTPs
- `cleanupVerified()` - Remove old verified OTPs

##### `services/user-service/src/models/settings.model.js`
**Purpose**: User preferences and privacy settings.

**Schema Fields**:
- **Identity**: id, user_id
- **Settings**: privacy_settings, notification_settings, display_settings, security_settings (all JSON)

**Instance Methods**:
- `updatePrivacySettings()` - Update privacy preferences
- `updateNotificationSettings()` - Update notification preferences
- `updateDisplaySettings()` - Update display preferences
- `updateSecuritySettings()` - Update security preferences
- `getAllSettings()` - Get all settings as object

**Class Methods**:
- `findByUserId()` - Find settings by user ID
- `createDefault()` - Create default settings for new user

##### `services/user-service/src/models/audit.model.js`
**Purpose**: Comprehensive audit logging for compliance.

**Schema Fields**:
- **Identity**: id, user_id
- **Action**: action, resource, resource_id
- **Data**: old_values, new_values (JSON)
- **Context**: ip_address, user_agent, session_id
- **Timestamp**: created_at

**Class Methods**:
- `logAction()` - Create audit log entry
- `findByUser()` - Get user's audit trail
- `findByResource()` - Get resource audit trail
- `cleanup()` - Remove old audit logs (7-year retention)

#### Validation Schemas (`src/schemas/`)

##### `services/user-service/src/schemas/base.schema.js`
**Purpose**: Common validation schemas used across the application.

**Schemas Defined**:
- `phoneSchema` - International phone number format
- `passwordSchema` - Password schema with comprehensive validation
- `otpCodeSchema` - 6-digit OTP validation
- `uuidSchema` - Validate UUID
- `deviceSchema` - Device information validation
- `paginationSchema` - Pagination limit 1 to 100
- `jwtTokenSchema` - Validate JWT token format
- `fileUploadSchema` - File upload validation
- `languageSchema` - Supported languages for display setting
- `userLanguageSchema` - User known Languages schema valids BCP 47 language tag
- `timezoneSchema` - IANA timezone validation
- `ipAddressSchema` - validate IP address format
- `userAgentSchema` - User agent must not exceed 500 characters

**Used By**: other validation schemas

##### `services/user-service/src/schemas/auth.schema.js`
**Purpose**: Joi validation schemas for authentication endpoints.

**Schemas Defined**:
- `userRegistrationSchema` - Complete registration validation
- `userLoginPasswordSchema` - Password login validation
- `userLoginOtpSchema` - OTP login validation
- `tokenRefreshSchema` - Token refresh validation
- `passwordResetSchema` - Password reset validation
- `passwordChangeSchema` - Password change validation
- `phoneChangeSchema` - Phone number change validation
- `sessionValidationSchema` - validate sessions
- `loginAttemptSchema` - validate login attempt
- `accountLockoutSchema` - Account lockout validation
- `authEventSchema` - Authentication event type validation ('login', 'logout', 'register', 'password_reset', 'password_change', 'phone_change')
- `rateLimitSchema` - Rate limit validation
- `securityHeadersSchema` - Authorization header must be in Bearer token format


**Used By**: `src/utils/validation.util.js`

##### `services/user-service/src/schemas/settings.schema.js`
**Purpose**: Joi validation schemas for user settings.

**Schemas Defined**:
- `privacySettingsSchema` - Privacy preferences validation
- `notificationSettingsSchema` - Notification preferences validation
- `displaySettingsSchema` - Display preferences validation
- `securitySettingsSchema` - Security preferences validation
- `settingsUpdateSchema` - Settings update validation(partial updates allowed)
- `settingsExportSchema` - Settings export validation
- `settingsImportSchema` - Settings import validation
- `settingsBackupSchema` - Settings backup validation

// Individual setting category schemas for granular updates
const privacyUpdateSchema = privacySettingsSchema;
const notificationUpdateSchema = notificationSettingsSchema;
const displayUpdateSchema = displaySettingsSchema;
const securityUpdateSchema = securitySettingsSchema;

**Used By**: `src/utils/validation.util.js`

##### `services/user-service/src/schemas/user.schema.js`
**Purpose**: Joi validation schemas for user-related operations.

**Schemas Defined**:
- `profileUpdateSchema` - Profile update validation
- `accountDeactivationSchema` - Account deactivation validation
- `accountDeletionSchema` - Password is required and must type "DELETE_MY_ACCOUNT" to confirm for account deletion
- `sessionRevocationSchema` - Session revocation validation

**Used By**: `src/utils/validation.util.js`

#### Business Logic Services (`src/services/`)

##### `services/user-service/src/services/auth.service.js`
**Purpose**: Core authentication business logic.

**Key Functions**:
- `registerUser()` - Complete user registration flow
- `loginUser()` - Password and OTP login handling
- `refreshTokens()` - JWT token refresh
- `logoutUser()` - Session termination
- `resetPassword()` - Password reset flow
- `handleFailedLogin()` - Failed attempt tracking
- `reactivateAccount()` - Account reactivation

**Dependencies**:
```javascript
const { User, UserSession, OtpVerification, UserSettings } = require('../models');
const sessionService = require('./session.service');
const encryptionService = require('./encryption.service');
const otpService = require('./otp.service');
const jwtUtil = require('../utils/jwt.util');
const passwordUtil = require('../utils/password.util');
```

**Security Features**:
- Account lockout protection
- Session management
- Device fingerprinting
- Audit logging integration

##### `services/user-service/src/services/profile.service.js`
**Purpose**: User profile management business logic.

**Key Functions**:
- `getUserProfile()` - Retrieve own profile
- `updateUserProfile()` - Update profile information
- `uploadAvatar()` - Avatar image upload
- `uploadCoverPhoto()` - Cover photo upload
- `getPublicUserProfile()` - Get other user's profile by Id

**Dependencies**:
```javascript
const { User } = require('../models');
const encryptionService = require('./encryption.service');
const cloudStorageService = require('./cloud-storage.service');
```

**Privacy Features**:
- Public vs private profile handling
- Data sanitization for different contexts
- Age validation for birth dates

##### `services/user-service/src/services/session.service.js`
**Purpose**: Session lifecycle management.

**Key Functions**:
- `createSession()` - New session creation
- `getSession()` - Session retrieval and validation
- `getUserSessions()` - List user's active sessions
- `revokeSession()` - Single session termination
- `revokeAllUserSessions()` - Bulk session termination
- `enforceSessionLimit()` - Session limit enforcement
- `isDeviceTrusted()` - Device trust verification

**Dependencies**:
```javascript
const { UserSession } = require('../models');
const jwtUtil = require('../utils/jwt.util');
```

**Security Features**:
- Session expiry management
- Device tracking
- Concurrent session limits
- Session activity updates

##### `services/user-service/src/services/settings.service.js`
**Purpose**: User settings and account management.

**Key Functions**:
- `getUserSettings()` - Retrieve user preferences
- `updateUserSettings()` - Update preferences
- `changePassword()` - Password change with validation
- `changePhoneNumber()` - Phone number change with OTP
- `deactivateAccount()` - Account deactivation
- `requestAccountDeletion()` - Deletion request with grace period

**Dependencies**:
```javascript
const { User, UserSettings } = require('../models');
const sessionService = require('./session.service');
const encryptionService = require('./encryption.service');
const otpService = require('./otp.service');
```

**Security Features**:
- Password confirmation for critical actions
- OTP verification for phone changes
- Grace period for account deletion

##### `services/user-service/src/services/otp.service.js`
**Purpose**: OTP generation, delivery, and verification.

**Key Functions**:
- `sendRegistrationOtp()` - Registration OTP flow
- `sendLoginOtp()` - Login OTP flow
- `sendPasswordResetOtp()` - Password reset OTP flow
- `sendPhoneChangeOtp()` - Phone change OTP flow
- `verifyOtp()` - OTP verification with attempt tracking
- `checkRateLimit()` - OTP request rate limiting

**Dependencies**:
```javascript
const { OtpVerification } = require('../models');
const validationUtil = require('../utils/validation.util');
```

**Security Features**:
- Rate limiting per phone number
- Attempt tracking and lockout
- Expiry management
- SMS integration (mocked)

##### `services/user-service/src/services/cloud-storage.service.js`
**Purpose**: Handles file uploads to cloud storage providers (e.g., Alibaba OSS) with mock implementation for development.

**Key Functions**:
- `uploadAvatar()` - Upload avatar
- `uploadCoverPhoto()` - Upload cover photo
- `deleteFile()` - Delete file from cloud

**Dependencies**:
```javascript
const crypto = require('crypto');
const logger = require('../utils/logger.util');
const { AppError } = require('../errors/AppError');
```

##### `services/user-service/src/services/encryption.service.js`
**Purpose**: High-level data encryption orchestration.

**Key Functions**:
- `encryptUserData()` - Encrypt user profile fields
- `decryptUserData()` - Decrypt user profile fields
- `encryptSettingsData()` - Encrypt user settings
- `decryptSettingsData()` - Decrypt user settings
- `encryptVerificationData()` - Encrypt verification data
- `bulkEncryptUsers()` - Bulk encryption operations

**Dependencies**:
```javascript
const encryptionUtil = require('../utils/encryption.util');
```

**Encryption Scope**:
- Phone numbers
- Personal names
- Birth dates
- Location data
- Verification documents

##### `services/user-service/src/services/admin.service.js`
**Purpose**: Administrative operations for user management.

**Key Functions**:
- `getUserList()` - Paginated user listing with filters
- `getUserDetails()` - Detailed user information
- `suspendUser()` - Account suspension with reason
- `unsuspendUser()` - Account unsuspension
- `verifyUser()` - Manual account verification
- `getUserStatistics()` - Platform statistics

**Dependencies**:
```javascript
const { User, UserSession, AuditLog } = require('../models');
const encryptionService = require('./encryption.service');
const sessionService = require('./session.service');
```

**Admin Features**:
- Comprehensive user search
- Bulk operations support
- Audit trail integration
- Statistics and reporting

##### `services/user-service/src/services/compliance.service.js`
**Purpose**: Compliance reporting and data export.

**Key Functions**:
- `getAuditLogs()` - Audit log retrieval with filters
- `getUserAuditTrail()` - User-specific audit trail
- `generateComplianceReport()` - PIPL/Cybersecurity/Data Security reports
- `exportUserData()` - GDPR-style data export
- `getSecurityEvents()` - Security incident tracking

**Dependencies**:
```javascript
const { AuditLog, User } = require('../models');
const encryptionService = require('./encryption.service');
```

**Compliance Features**:
- PIPL compliance reporting
- Cybersecurity Law incident tracking
- Data Security Law classification
- Data portability support

#### Utility Functions (`src/utils/`)

##### `services/user-service/src/utils/jwt.util.js`
**Purpose**: JWT token management specific to User Service.

**Key Functions**:
- `generateAccessToken()` - Create short-lived access tokens
- `generateRefreshToken()` - Create long-lived refresh tokens
- `generateTokenPair()` - Create access + refresh token pair
- `verifyAccessToken()` - Validate access tokens
- `verifyRefreshToken()` - Validate refresh tokens
- `refreshAccessToken()` - Generate new access token from refresh
- `extractToken()` - Extract token from Authorization header

**Dependencies**:
```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const securityConfig = require('../config/security.config');
```

**Security Features**:
- Payload encryption support
- Clock tolerance for time skew
- Token rotation capabilities
- Comprehensive error handling

##### `services/user-service/src/utils/password.util.js`
**Purpose**: Password security and validation utilities.

**Key Functions**:
- `hashPassword()` - Bcrypt password hashing
- `comparePassword()` - Password verification
- `validatePassword()` - Strength validation
- `calculateEntropy()` - Password entropy calculation
- `hasCommonPatterns()` - Common pattern detection
- `generateSecurePassword()` - Secure password generation

**Dependencies**:
```javascript
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const securityConfig = require('../config/security.config');
```

**Security Features**:
- Configurable complexity requirements
- Common pattern detection
- Entropy calculation
- Password history support

##### `services/user-service/src/utils/phone.util.js`
**Purpose**: Phone number validation and formatting utilities.

**Key Functions**:
- `validatePhoneNumber()` - Comprehensive phone validation
- `formatForStorage()` - Database storage format
- `formatForDisplay()` - User display format
- `validateChinesePhoneNumber()` - China-specific validation
- `getCarrierInfo()` - Chinese carrier identification
- `maskPhoneNumber()` - Privacy masking

**Dependencies**:
```javascript
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');
```

**Features**:
- International format support
- Chinese carrier detection
- Privacy masking
- Search variation generation

##### `services/user-service/src/utils/validation.util.js`
**Purpose**: Comprehensive centralized validation utilities using Joi schemas. Schemas handle format validation, and utility functions handle business logic.

**Key Functions**:
- `validatePhoneNumber()` - Validate phone number using phone utility
- `validatePassword()` - Validate password using password utility
- `validateOTP()` - Validate OTP code using base schema
- `validateRegistration()` - Validate user registration data using auth schema
- `validateLogin()` - Validate user login data using auth schemas
- `validateProfileUpdate()` - Validate profile update data using user schema
- `validateBioContent()` - Validate bio content for inappropriate content (business logic)
- `validateSettingsUpdate()` - Validate settings update data using settings schema
- `validatePasswordChange()` - Validate password change data using auth schema
- `validatePhoneChange()` - Validate phone number change data using auth schema
- `validatePasswordReset()` - Validate password reset using auth schema
- `validateFileUpload()` - Validate file upload using base schema with business logic
- `validatePagination()` - Validate pagination using base schema
- `validateOTPRequest()` - Validate OTP request type using auth schema
- `sanitizeHtml()` - Sanitize HTML content using DOMpurify (business logic)
- `validateTokenRefresh()` - Validate token refresh using auth schema
- `validateLoginAttempt()` - Validate login attempt payload using auth schema
- `validateAccountLockout()` - Validate account lockout payload using auth schema
- `validateAuthEvent()` - Validate authentication event using auth schema
- `validateRateLimit()` - Validate rate limit check using auth schema
- `validateSecurityHeaders()` - Validate security headers using auth schema
- `validateSessionValidation()` - Validate session validation payload using auth schema
- `validateSessionRevocation()` - Validate session revocation data using user schema
- `validateAccountDeactivation()` - Validate account deactivation data using user schema
- `validateAccountDeletion()` - Validate account deletion data using user schema
- `validateSettingsExport()` - Validate export settings input using settings schema
- `validateSettingsImport()` - Validate settings import using settings schema
- `validateSettingsBackup()` - Validate login attempt payload using auth schema using settings schema
- `validateUUID()` - Validate UUID format using base schema
- `validateDeviceInfo()` - Validate device information using base schema
- `validateJWTToken()` - Validate JWT token format using base schema
- `validateWithSchema()` - Generic schema validation wrapper using settings schema

**Dependencies**:
```javascript
const Joi = require('joi');
const phoneUtil = require('./phone.util');
```

**Validation Features**:
- Multi-language support
- Content moderation
- File upload validation

##### `services/user-service/src/utils/encryption.util.js`
**Purpose**: Low-level cryptographic operations.

**Key Functions**:
- `encrypt()` - AES-256-GCM encryption
- `decrypt()` - AES-256-GCM decryption
- `encryptUserFields()` - Bulk field encryption
- `decryptUserFields()` - Bulk field decryption
- `hash()` - One-way hashing
- `generateHMAC()` - Data integrity verification
- `generateSecureRandom()` - Cryptographically secure random generation

**Dependencies**:
```javascript
const crypto = require('crypto');
const securityConfig = require('../config/security.config');
```

**Cryptographic Features**:
- AES-256-GCM authenticated encryption
- Key rotation support
- HMAC data integrity
- Secure random generation

##### `services/user-service/src/utils/logger.util.js`
**Purpose**: Service-specific logging with Winston and Bunyan.

**Key Functions**:
- `info()`, `error()`, `warn()`, `debug()` - Standard logging levels
- `audit()` - Audit event logging
- `security()` - Security event logging
- `performance()` - Performance metrics logging
- `apiRequest()` - API request logging
- `dbQuery()` - Database query logging

**Dependencies**:
```javascript
const winston = require('winston');
const bunyan = require('bunyan');
```

**Logging Features**:
- Structured JSON logging
- Multiple transports (console, file)
- Context enrichment
- Performance tracking

### 4.3 Shared Libraries (`shared/`)

#### `shared/utils/api.response.js`
**Purpose**: Standardized API response formatting across all microservices.

**Response Methods**:
- `success()` - Success responses with data
- `error()` - Error responses with details
- `validationError()` - Validation failure responses
- `authError()` - Authentication failure responses
- `notFound()` - Resource not found responses
- `rateLimitError()` - Rate limit exceeded responses
- `paginated()` - Paginated data responses
- `created()` - Resource creation responses

**Response Format**:
```json
{
  "success": true|false,
  "data": {...},
  "message": "Human readable message",
  "timestamp": "ISO_DATE_STRING",
  "request_id": "UUID",
  "meta": {...}
}
```

**Used By**: All controllers across all microservices

#### `shared/libraries/auth/jwt.strategy.js`
**Purpose**: Shared JWT verification strategy for cross-service authentication.

**Key Functions**:
- `verifyAccessToken()` - Verify tokens issued by User Service
- `verifyRefreshToken()` - Verify refresh tokens
- `extractToken()` - Extract token from headers
- `validateTokenFormat()` - Basic format validation

**Dependencies**:
```javascript
const jwt = require('jsonwebtoken');
```

**Usage Context**:
- API Gateway token verification
- Inter-service authentication
- Other microservices validating User Service tokens

**Difference from `jwt.util.js`**: This focuses on verification only, while `jwt.util.js` handles full token lifecycle

#### `shared/libraries/cache/redis.client.js`
**Purpose**: Centralized Redis client management for all services.

**Key Functions**:
- `connect()` - Establish Redis connection
- `set()`, `get()`, `del()` - Basic cache operations
- `exists()`, `expire()` - Cache management
- `mget()` - Bulk operations
- `incr()` - Counter operations
- `ping()` - Health checking

**Dependencies**:
```javascript
const redis = require('redis');
```

**Features**:
- Connection pooling
- Error handling and reconnection
- Health monitoring
- Performance metrics

**Used By**: 
- User Service for session storage and rate limiting
- Future services for caching and pub/sub

#### `shared/libraries/database/mysql.pool.js`
**Purpose**: Centralized MySQL connection pool management.

**Key Functions**:
- `initialize()` - Create connection pool
- `testConnection()` - Health checking
- `query()` - Execute SQL queries
- `getConnection()` - Acquire connection from pool
- `close()` - Graceful shutdown
- `getStats()` - Pool statistics

**Dependencies**:
```javascript
const mysql = require('mysql2/promise');
```

**Features**:
- Connection pooling with limits
- Health monitoring
- Automatic reconnection
- Performance tracking

**Used By**: Services requiring direct SQL access (bypassing ORM)

#### `shared/libraries/logging/logger.js`
**Purpose**: Platform-wide logging foundation.

**Key Functions**:
- Standard logging levels (info, error, warn, debug)
- `audit()` - Audit event logging
- `security()` - Security event logging
- `performance()` - Performance metrics
- `child()` - Context-aware child loggers

**Dependencies**:
```javascript
const winston = require('winston');
```

**Features**:
- Structured JSON logging
- Multiple transports
- Service context injection
- Environment-aware configuration

**Used By**: All shared libraries and can be extended by service-specific loggers

### 4.4 Database (`services/user-service/db/migrations/`)

#### Migration Files Overview
All migration files follow the naming convention: `YYYYMMDDHHMMSS_descriptive_name.sql`

**Migration Order**:
1. `YYYYMMDDHHMMSS_users.sql` - Users table
2. `YYYYMMDDHHMMSS_user_sessions.sql` - User sessions table  
3. `YYYYMMDDHHMMSS_otp_verifications.sql` - OTP verifications table
4. `YYYYMMDDHHMMSS_user_settings.sql` - User settings table
5. `YYYYMMDDHHMMSS_audit_logs.sql` - Audit logs table

**Key Features**:
- Foreign key constraints with appropriate CASCADE/SET NULL policies
- Optimized indexes for performance
- JSON fields for flexible data storage
- Enum types for data integrity
- Comprehensive timestamp tracking

#### Table Relationships
```
users (1) ←→ (many) user_sessions
users (1) ←→ (many) otp_verifications  
users (1) ←→ (1) user_settings
users (1) ←→ (many) audit_logs
```

### 4.5 Seed Data (`services/user-service/seeds/`)

#### `services/user-service/seeds/001_demo_users.js`
**Purpose**: Populate database with demo user accounts for development.

**Demo Users Created**:
- Demo User (+86-138-0013-8000) - Basic user
- Test User (+86-138-0013-8001) - Verified user
- Private User (+86-138-0013-8002) - Private profile

**Features**:
- Bcrypt-hashed passwords
- Realistic profile data
- Different account states for testing

### 4.6 Docker Configuration

#### `services/user-service/Dockerfile`
**Purpose**: Production-ready container image for User Service.

**Build Stages**:
1. **Builder Stage**: Install dependencies and prepare application
2. **Production Stage**: Minimal runtime environment

**Security Features**:
- Non-root user execution
- Minimal attack surface with Alpine Linux
- Health checks for container monitoring
- Proper signal handling with dumb-init

#### `services/user-service/docker-compose.test.yml`
**Purpose**: Complete testing environment with all dependencies.

**Services**:
- `user-service` - The main application
- `mysql` - Database with initialization scripts
- `redis` - Cache and session store
- `adminer` - Database administration interface

**Features**:
- Isolated network for security
- Volume persistence for data
- Environment variable configuration
- Service dependency management

---

## 5. API Documentation

### 5.1 Authentication Flow

#### Registration Flow
```mermaid
sequenceDiagram
    participant Client
    participant UserService
    participant SMS
    participant Database

    Client->>UserService: POST /auth/register/otp {phone}
    UserService->>SMS: Send OTP
    UserService->>Database: Store OTP record
    UserService-->>Client: {verification_id, expires_in}
    
    Client->>UserService: POST /auth/register {phone, password, verification_id, otp_code, device_info}
    UserService->>Database: Verify OTP
    UserService->>Database: Create user account
    UserService->>Database: Create user settings
    UserService->>Database: Create session
    UserService-->>Client: {user, tokens, session}
```

#### Login Flow (Password)
```mermaid
sequenceDiagram
    participant Client
    participant UserService
    participant Database
    participant Redis

    Client->>UserService: POST /auth/login {phone, password, device_info}
    UserService->>Database: Find user by phone
    UserService->>UserService: Validate password
    UserService->>Database: Update login tracking
    UserService->>Database: Create session
    UserService->>Redis: Store session data
    UserService-->>Client: {user, tokens, session}
```

#### Token Refresh Flow
```mermaid
sequenceDiagram
    participant Client
    participant UserService
    participant Database

    Client->>UserService: POST /auth/refresh {refresh_token}
    UserService->>UserService: Verify refresh token
    UserService->>Database: Validate session
    UserService->>UserService: Generate new tokens
    UserService->>Database: Update session
    UserService-->>Client: {tokens}
```

### 5.2 API Response Format

All API responses follow this standardized format:

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "message": "Operation successful",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "request_id": "uuid-v4"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  },
  "timestamp": "2025-01-20T12:00:00.000Z",
  "request_id": "uuid-v4"
}
```

#### Validation Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "validation_errors": [
        {
          "field": "phone",
          "message": "Phone number is required",
          "value": null,
          "constraint": "required"
        }
      ]
    }
  },
  "timestamp": "2025-01-20T12:00:00.000Z",
  "request_id": "uuid-v4"
}
```

### 5.3 Authentication & Authorization

#### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": 123,
    "sessionId": "uuid-v4",
    "deviceId": "device-identifier",
    "roles": ["user"],
    "permissions": [],
    "type": "access",
    "iat": 1642680000,
    "exp": 1642681800,
    "iss": "lianxin-user-service",
    "aud": "lianxin-app"
  }
}
```

#### Authorization Header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5.4 Rate Limiting

| Endpoint Type | Window | Limit | Key |
|---------------|--------|-------|-----|
| Global | 1 hour | 1000 requests | IP + User ID |
| Authentication | 15 minutes | 10 attempts | IP |
| Registration | 1 hour | 5 attempts | IP |
| OTP Requests | 5 minutes | 5 requests | Phone |
| Password Reset | 1 hour | 3 attempts | Phone |
| File Upload | 1 minute | 5 uploads | User ID |
| Admin Actions | 1 minute | 50 actions | User ID |

### 5.5 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `AUTHENTICATION_ERROR` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password |
| `EXPIRED_TOKEN` | 401 | JWT token expired |
| `INSUFFICIENT_PERMISSIONS` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## 6. File Dependencies & Connections

### 6.1 Dependency Graph

```mermaid
graph TD
    A[app.js] --> B[Controllers]
    A --> C[Middleware]
    A --> D[Config]
    A --> E[Shared Libraries]
    
    B --> F[Services]
    B --> G[Validation Utils]
    B --> H[API Response]
    
    F --> I[Models]
    F --> J[Utils]
    F --> K[Encryption Service]
    
    I --> L[Database Config]
    I --> M[Sequelize]
    
    C --> N[Auth Utils]
    C --> O[Rate Limit Config]
    C --> P[Redis Client]
    
    J --> Q[Security Config]
    J --> R[Logger]
    
    E --> S[MySQL Pool]
    E --> T[Redis Client]
    E --> U[Shared Logger]
```

### 6.2 Critical File Relationships

#### Authentication Chain
```
auth.controller.js → auth.service.js → user.model.js → database
                  ↓
                  otp.service.js → otp.model.js → database
                  ↓
                  session.service.js → session.model.js → database
                  ↓
                  jwt.util.js → security.config.js
```

#### Middleware Chain
```
Request → rate-limit.middleware.js → auth.middleware.js → validation.middleware.js → Controller
                                   ↓
                                   audit.middleware.js → audit.model.js → database
```

#### Encryption Chain
```
Controller → encryption.middleware.js → encryption.service.js → encryption.util.js → security.config.js
```

### 6.3 Configuration Dependencies

#### Environment Variables Flow
```
.env → app.config.js → app.js → Services/Middleware
     → database.config.js → models/index.js → Models
     → redis.config.js → redis.client.js → Middleware
     → security.config.js → Utils → Services
```

#### Shared Library Usage
```
user-service/app.js → shared/libraries/database/mysql.pool.js
                   → shared/libraries/cache/redis.client.js
                   → shared/utils/api.response.js

Controllers → shared/utils/api.response.js

Other Services → shared/libraries/auth/jwt.strategy.js
```

---

## 7. Frontend Integration Strategy

### 7.1 Architecture Overview

The frontend applications (Flutter mobile app, React admin panel) will communicate with the User Service through RESTful APIs. The integration follows a client-server architecture with JWT-based authentication.

```mermaid
graph LR
    A[Flutter Mobile App] --> D[API Gateway]
    B[React Admin Panel] --> D
    C[Web Application] --> D
    D --> E[User Service]
    D --> F[Social Service]
    D --> G[Content Service]
    E --> H[MySQL Database]
    E --> I[Redis Cache]
```

### 7.2 Frontend Application Types

#### 7.2.1 Flutter Mobile Application
**Target**: iOS and Android users
**Features**:
- User registration and authentication
- Profile management
- Social interactions
- Content creation and consumption
- Push notifications
- Offline capabilities

#### 7.2.2 React Admin Panel
**Target**: Platform administrators
**Features**:
- User management
- Content moderation
- Analytics and reporting
- Compliance monitoring
- System configuration

#### 7.2.3 Web Application (Future)
**Target**: Desktop users
**Features**:
- Full social media functionality
- Advanced content creation tools
- Analytics dashboard
- Real-time messaging

#### 7.3.3 Data Models

**User Model (Flutter)**:
```dart
class User {
  final int id;
  final String uuid;
  final String phone;
  final String? displayName;
  final String? firstName;
  final String? lastName;
  final String? bio;
  final String? avatarUrl;
  final String? coverPhotoUrl;
  final DateTime? birthDate;
  final String? gender;
  final bool isVerified;
  final bool isPrivate;
  final DateTime createdAt;
  
  User({
    required this.id,
    required this.uuid,
    required this.phone,
    this.displayName,
    this.firstName,
    this.lastName,
    this.bio,
    this.avatarUrl,
    this.coverPhotoUrl,
    this.birthDate,
    this.gender,
    required this.isVerified,
    required this.isPrivate,
    required this.createdAt,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      uuid: json['uuid'],
      phone: json['phone'],
      displayName: json['display_name'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      bio: json['bio'],
      avatarUrl: json['avatar_url'],
      coverPhotoUrl: json['cover_photo_url'],
      birthDate: json['birth_date'] != null ? DateTime.parse(json['birth_date']) : null,
      gender: json['gender'],
      isVerified: json['is_verified'],
      isPrivate: json['is_private'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'uuid': uuid,
      'phone': phone,
      'display_name': displayName,
      'first_name': firstName,
      'last_name': lastName,
      'bio': bio,
      'avatar_url': avatarUrl,
      'cover_photo_url': coverPhotoUrl,
      'birth_date': birthDate?.toIso8601String(),
      'gender': gender,
      'is_verified': isVerified,
      'is_private': isPrivate,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
```

#### 7.3.4 API Service Classes

**Authentication Service (Flutter)**:
```dart
class AuthApiService {
  final ApiClient _apiClient;
  
  AuthApiService(this._apiClient);
  
  Future<ApiResponse<Map<String, dynamic>>> requestRegistrationOtp(String phone) async {
    try {
      final response = await _apiClient.post('/auth/register/otp', data: {
        'phone': phone,
      });
      return ApiResponse.success(response.data['data']);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
  
  Future<ApiResponse<AuthResult>> register({
    required String phone,
    required String password,
    required String verificationId,
    required String otpCode,
    required DeviceInfo deviceInfo,
  }) async {
    try {
      final response = await _apiClient.post('/auth/register', data: {
        'phone': phone,
        'password': password,
        'verification_id': verificationId,
        'otp_code': otpCode,
        'agree_terms': true,
        'device_id': deviceInfo.deviceId,
        'device_type': deviceInfo.deviceType,
        'device_name': deviceInfo.deviceName,
      });
      
      final data = response.data['data'];
      return ApiResponse.success(AuthResult.fromJson(data));
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
  
  Future<ApiResponse<AuthResult>> login({
    required String phone,
    required String password,
    required DeviceInfo deviceInfo,
  }) async {
    try {
      final response = await _apiClient.post('/auth/login', data: {
        'phone': phone,
        'password': password,
        'device_id': deviceInfo.deviceId,
        'device_type': deviceInfo.deviceType,
        'device_name': deviceInfo.deviceName,
      });
      
      final data = response.data['data'];
      return ApiResponse.success(AuthResult.fromJson(data));
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
}
```

**Profile Service (Flutter)**:
```dart
class ProfileApiService {
  final ApiClient _apiClient;
  
  ProfileApiService(this._apiClient);
  
  Future<ApiResponse<User>> getProfile() async {
    try {
      final response = await _apiClient.get('/user/profile');
      final userData = response.data['data']['user'];
      return ApiResponse.success(User.fromJson(userData));
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
  
  Future<ApiResponse<void>> updateProfile(Map<String, dynamic> profileData) async {
    try {
      await _apiClient.put('/user/profile', data: profileData);
      return ApiResponse.success(null);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
  
  Future<ApiResponse<String>> uploadAvatar(File imageFile) async {
    try {
      final formData = FormData.fromMap({
        'avatar': await MultipartFile.fromFile(
          imageFile.path,
          filename: 'avatar.jpg',
        ),
      });
      
      final response = await _apiClient.post('/user/avatar', data: formData);
      final avatarUrl = response.data['data']['avatar_url'];
      return ApiResponse.success(avatarUrl);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }
}
```

### 7.4 State Management

#### 7.4.1 Flutter State Management (Provider/Riverpod)

**Auth Provider**:
```dart
class AuthProvider extends ChangeNotifier {
  User? _currentUser;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  
  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  
  Future<bool> login(String phone, String password) async {
    _setLoading(true);
    
    try {
      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      final result = await AuthApiService().login(
        phone: phone,
        password: password,
        deviceInfo: deviceInfo,
      );
      
      if (result.isSuccess) {
        await AuthService().saveTokens(
          result.data!.tokens.accessToken,
          result.data!.tokens.refreshToken,
        );
        _currentUser = result.data!.user;
        _isAuthenticated = true;
        notifyListeners();
        return true;
      } else {
        _showError(result.error);
        return false;
      }
    } finally {
      _setLoading(false);
    }
  }
  
  Future<void> logout() async {
    await AuthApiService().logout();
    await AuthService().clearTokens();
    _currentUser = null;
    _isAuthenticated = false;
    notifyListeners();
  }
  
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }
}
```

#### 7.4.2 React State Management (Redux/Context)

**Auth Context**:
```javascript
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  const login = async (phone, password) => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const deviceInfo = getDeviceInfo();
      const response = await authApi.login({ phone, password, ...deviceInfo });
      
      if (response.success) {
        const { user, tokens } = response.data;
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, tokens } });
        return { success: true };
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: response.error });
        return { success: false, error: response.error };
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error.message });
      return { success: false, error: error.message };
    }
  };
  
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      dispatch({ type: 'LOGOUT' });
    }
  };
  
  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 7.5 Error Handling Strategy

#### 7.5.1 Frontend Error Handling

**Error Response Processing (Flutter)**:
```dart
class ApiResponse<T> {
  final bool isSuccess;
  final T? data;
  final String? error;
  final String? errorCode;
  final List<ValidationError>? validationErrors;
  
  ApiResponse.success(this.data) : isSuccess = true, error = null, errorCode = null, validationErrors = null;
  ApiResponse.error(this.error, {this.errorCode, this.validationErrors}) : isSuccess = false, data = null;
  
  factory ApiResponse.fromResponse(Response response) {
    final responseData = response.data;
    
    if (responseData['success'] == true) {
      return ApiResponse.success(responseData['data']);
    } else {
      final error = responseData['error'];
      final validationErrors = error['details']?['validation_errors']
          ?.map<ValidationError>((e) => ValidationError.fromJson(e))
          ?.toList();
      
      return ApiResponse.error(
        error['message'],
        errorCode: error['code'],
        validationErrors: validationErrors,
      );
    }
  }
}

class ValidationError {
  final String field;
  final String message;
  final dynamic value;
  final String constraint;
  
  ValidationError({
    required this.field,
    required this.message,
    this.value,
    required this.constraint,
  });
  
  factory ValidationError.fromJson(Map<String, dynamic> json) {
    return ValidationError(
      field: json['field'],
      message: json['message'],
      value: json['value'],
      constraint: json['constraint'],
    );
  }
}
```

**Error Display (Flutter)**:
```dart
class ErrorHandler {
  static void showError(BuildContext context, String error, {String? errorCode}) {
    String displayMessage = error;
    
    // Customize messages based on error codes
    switch (errorCode) {
      case 'RATE_LIMIT_EXCEEDED':
        displayMessage = 'Too many requests. Please try again later.';
        break;
      case 'INVALID_CREDENTIALS':
        displayMessage = 'Invalid phone number or password.';
        break;
      case 'ACCOUNT_LOCKED':
        displayMessage = 'Account temporarily locked due to failed login attempts.';
        break;
      default:
        displayMessage = error;
    }
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(displayMessage),
        backgroundColor: Colors.red,
        duration: Duration(seconds: 3),
      ),
    );
  }
  
  static Map<String, String> processValidationErrors(List<ValidationError> errors) {
    final Map<String, String> fieldErrors = {};
    for (final error in errors) {
      fieldErrors[error.field] = error.message;
    }
    return fieldErrors;
  }
}
```

### 7.6 Real-time Features (Future Implementation)

#### 7.6.1 WebSocket Integration

**WebSocket Service (Flutter)**:
```dart
class WebSocketService {
  IOWebSocketChannel? _channel;
  StreamController<dynamic> _messageController = StreamController.broadcast();
  
  Stream<dynamic> get messages => _messageController.stream;
  
  Future<void> connect(String token) async {
    try {
      _channel = IOWebSocketChannel.connect(
        'wss://api.lianxin.com/ws',
        headers: {'Authorization': 'Bearer $token'},
      );
      
      _channel!.stream.listen(
        (message) {
          final data = jsonDecode(message);
          _messageController.add(data);
        },
        onError: (error) {
          print('WebSocket error: $error');
          _reconnect();
        },
        onDone: () {
          print('WebSocket connection closed');
          _reconnect();
        },
      );
    } catch (e) {
      print('Failed to connect WebSocket: $e');
    }
  }
  
  void sendMessage(Map<String, dynamic> message) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(message));
    }
  }
  
  void _reconnect() {
    // Implement reconnection logic with exponential backoff
  }
  
  void disconnect() {
    _channel?.sink.close();
    _messageController.close();
  }
}
```

#### 7.6.2 Push Notifications

**Firebase Integration (Flutter)**:
```dart
class PushNotificationService {
  static FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  
  static Future<void> initialize() async {
    // Request permission
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // Get FCM token
      String? token = await _firebaseMessaging.getToken();
      if (token != null) {
        // Send token to backend
        await UserApiService().updateFCMToken(token);
      }
      
      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      
      // Handle background messages
      FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessage);
      
      // Handle notification taps
      FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
    }
  }
  
  static void _handleForegroundMessage(RemoteMessage message) {
    // Show in-app notification
  }
  
  static Future<void> _handleBackgroundMessage(RemoteMessage message) async {
    // Handle background notification
  }
  
  static void _handleNotificationTap(RemoteMessage message) {
    // Navigate to relevant screen
  }
}
```

### 7.7 Offline Support

#### 7.7.1 Local Database (Flutter)

**SQLite Integration**:
```dart
class LocalDatabase {
  static Database? _database;
  
  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }
  
  static Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'lianxin.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }
  
  static Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE users(
        id INTEGER PRIMARY KEY,
        uuid TEXT,
        phone TEXT,
        display_name TEXT,
        avatar_url TEXT,
        is_verified INTEGER,
        synced INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    ''');
    
    await db.execute('''
      CREATE TABLE posts(
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        content TEXT,
        media_urls TEXT,
        created_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    ''');
  }
}
```

**Sync Service**:
```dart
class SyncService {
  static Future<void> syncData() async {
    if (await ConnectivityService.isOnline()) {
      await _syncUsers();
      await _syncPosts();
      await _uploadPendingData();
    }
  }
  
  static Future<void> _syncUsers() async {
    // Fetch updated user data from API
    // Update local database
  }
  
  static Future<void> _uploadPendingData() async {
    // Upload locally created content
    // Mark as synced when successful
  }
}
```

### 7.8 Performance Optimization

#### 7.8.1 Caching Strategy

**API Response Caching (Flutter)**:
```dart
class CacheManager {
  static const Duration defaultCacheDuration = Duration(minutes: 5);
  static final Map<String, CacheEntry> _cache = {};
  
  static Future<T?> get<T>(String key) async {
    final entry = _cache[key];
    if (entry != null && !entry.isExpired) {
      return entry.data as T;
    }
    return null;
  }
  
  static void set<T>(String key, T data, {Duration? duration}) {
    _cache[key] = CacheEntry(
      data: data,
      expiresAt: DateTime.now().add(duration ?? defaultCacheDuration),
    );
  }
  
  static void clear() {
    _cache.clear();
  }
}

class CacheEntry {
  final dynamic data;
  final DateTime expiresAt;
  
  CacheEntry({required this.data, required this.expiresAt});
  
  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
```

#### 7.8.2 Image Optimization

**Image Loading (Flutter)**:
```dart
class OptimizedImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  
  const OptimizedImage({
    Key? key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, url) => Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Container(
          width: width,
          height: height,
          color: Colors.white,
        ),
      ),
      errorWidget: (context, url, error) => Container(
        width: width,
        height: height,
        color: Colors.grey[300],
        child: Icon(Icons.error),
      ),
      memCacheWidth: width?.toInt(),
      memCacheHeight: height?.toInt(),
    );
  }
}
```

---

## 8. Development Workflow

### 8.1 Environment Setup

#### 8.1.1 Backend Development

**Prerequisites**:
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+
- Docker (optional)

**Setup Steps**:
```bash
# Clone repository
git clone <repository-url>
cd lianxin

# Install dependencies
cd services/user-service
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run migrate
npm run seed

# Start development server
npm run dev
```

#### 8.1.2 Frontend Development

**Flutter Setup**:
```bash
# Install Flutter SDK
# Add to PATH

# Create new Flutter project
flutter create lianxin_mobile
cd lianxin_mobile

# Add dependencies
flutter pub add dio
flutter pub add provider
flutter pub add shared_preferences
flutter pub add cached_network_image
flutter pub add image_picker

# Run app
flutter run
```

**React Setup**:
```bash
# Create React app
npx create-react-app lianxin-admin
cd lianxin-admin

# Add dependencies
npm install axios react-router-dom @reduxjs/toolkit react-redux

# Start development server
npm start
```

### 8.2 Testing Strategy

#### 8.2.1 Backend Testing

**Unit Tests**:
```javascript
// Example: auth.service.test.js
const authService = require('../src/services/auth.service');
const { User } = require('../src/models');

describe('AuthService', () => {
  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        phone: '+86-138-0013-8000',
        password: 'Password123!',
        verification_id: 'uuid-v4',
        otp_code: '123456',
        device_id: 'device-123',
        device_type: 'mobile',
        device_name: 'iPhone 12',
      };
      
      const result = await authService.registerUser(userData);
      
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.session).toBeDefined();
    });
  });
});
```

**Integration Tests**:
```javascript
// Example: auth.integration.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phone: '+86-138-0013-8000',
          password: 'Password123!',
          verification_id: 'uuid-v4',
          otp_code: '123456',
          agree_terms: true,
          device_id: 'device-123',
          device_type: 'mobile',
          device_name: 'iPhone 12',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });
  });
});
```

#### 8.2.2 Frontend Testing

**Flutter Widget Tests**:
```dart
// Example: login_screen_test.dart
void main() {
  group('LoginScreen', () => {
    testWidgets('should display login form', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));
      
      expect(find.byType(TextField), findsNWidgets(2)); // Phone and password
      expect(find.byType(ElevatedButton), findsOneWidget); // Login button
      expect(find.text('Login'), findsOneWidget);
    });
    
    testWidgets('should show error for invalid phone', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));
      
      await tester.enterText(find.byKey(Key('phone_field')), 'invalid');
      await tester.tap(find.byKey(Key('login_button')));
      await tester.pump();
      
      expect(find.text('Invalid phone number'), findsOneWidget);
    });
  });
}
```

### 8.3 Code Quality

#### 8.3.1 Linting and Formatting

**ESLint Configuration (.eslintrc.js)**:
```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
```

**Prettier Configuration (.prettierrc)**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

#### 8.3.2 Git Hooks

**Pre-commit Hook**:
```bash
#!/bin/sh
# Run linting
npm run lint

# Run tests
npm test

# Check formatting
npm run format:check
```

### 8.4 CI/CD Pipeline

#### 8.4.1 GitHub Actions Workflow

```yaml
name: User Service CI/CD

on:
  push:
    branches: [main, develop]
    paths: ['services/user-service/**']
  pull_request:
    branches: [main]
    paths: ['services/user-service/**']

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: lianxin_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
      
      redis:
        image: redis:6.0
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: services/user-service/package-lock.json
      
      - name: Install dependencies
        run: |
          cd services/user-service
          npm ci
      
      - name: Run linting
        run: |
          cd services/user-service
          npm run lint
      
      - name: Run tests
        run: |
          cd services/user-service
          npm test
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_NAME: lianxin_test
          DB_USER: root
          DB_PASSWORD: password
          REDIS_HOST: localhost
      
      - name: Build Docker image
        run: |
          cd services/user-service
          docker build -t user-service:${{ github.sha }} .
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        run: |
          # Deployment steps
          echo "Deploying to production..."
```

---

## 9. Deployment & Operations

### 9.1 Production Deployment

#### 9.1.1 Kubernetes Deployment

**Deployment Manifest**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service Manifest**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
```

#### 9.1.2 Environment Configuration

**Production Environment Variables**:
```bash
# Application
NODE_ENV=production
PORT=3001
SERVICE_NAME=user-service

# Database
DB_HOST=mysql-cluster.internal
DB_PORT=3306
DB_NAME=lianxin_prod
DB_USER=lianxin_user
DB_PASSWORD=<secure-password>
DB_SSL_ENABLED=true

# Redis
REDIS_HOST=redis-cluster.internal
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# JWT
JWT_ACCESS_TOKEN_SECRET=<256-bit-secret>
JWT_REFRESH_TOKEN_SECRET=<256-bit-secret>

# Encryption
ENCRYPTION_PRIMARY_KEY=<32-byte-hex-key>
ENCRYPTION_SECONDARY_KEY=<32-byte-hex-key>

# SMS
ALIBABA_SMS_ACCESS_KEY_ID=<access-key>
ALIBABA_SMS_ACCESS_KEY_SECRET=<secret-key>

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 9.2 Monitoring & Observability

#### 9.2.1 Health Checks

**Health Check Endpoint**:
```javascript
// In app.js
app.get('/health', async (req, res) => {
  const health = {
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'unknown',
      redis: 'unknown',
      memory: 'unknown',
    },
  };
  
  try {
    // Database health check
    await mysqlPool.testConnection();
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  try {
    // Redis health check
    await redisClient.ping();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.checks.redis = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Memory check
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  health.checks.memory = memUsageMB < 400 ? 'healthy' : 'warning';
  health.memory_usage_mb = memUsageMB;
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

#### 9.2.2 Metrics Collection

**Prometheus Metrics**:
```javascript
const promClient = require('prom-client');

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
});

// Middleware to collect metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

#### 9.2.3 Logging Strategy

**Structured Logging**:
```javascript
// Example log entry
{
  "timestamp": "2025-01-20T12:00:00.000Z",
  "level": "info",
  "service": "user-service",
  "environment": "production",
  "message": "User logged in successfully",
  "userId": 123,
  "sessionId": "uuid-v4",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req-uuid-v4",
  "duration": 150,
  "traceId": "trace-uuid-v4"
}
```

### 9.3 Security Operations

#### 9.3.1 Security Monitoring

**Security Event Detection**:
```javascript
class SecurityMonitor {
  static async detectSuspiciousActivity(userId, ipAddress, userAgent) {
    // Check for multiple failed login attempts
    const failedAttempts = await AuditLog.count({
      where: {
        user_id: userId,
        action: 'login_failed',
        created_at: {
          [Op.gte]: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
    });
    
    if (failedAttempts >= 5) {
      await this.triggerSecurityAlert('MULTIPLE_FAILED_LOGINS', {
        userId,
        ipAddress,
        failedAttempts,
      });
    }
    
    // Check for login from new location
    const recentLogins = await AuditLog.findAll({
      where: {
        user_id: userId,
        action: 'login_success',
        created_at: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      limit: 10,
    });
    
    const knownIPs = recentLogins.map(log => log.ip_address);
    if (!knownIPs.includes(ipAddress)) {
      await this.triggerSecurityAlert('LOGIN_FROM_NEW_LOCATION', {
        userId,
        ipAddress,
        userAgent,
      });
    }
  }
  
  static async triggerSecurityAlert(alertType, details) {
    logger.security('Security alert triggered', {
      alertType,
      details,
      timestamp: new Date().toISOString(),
    });
    
    // Send alert to security team
    // Could integrate with external alerting systems
  }
}
```

#### 9.3.2 Data Protection

**Data Encryption at Rest**:
- Database encryption using MySQL's transparent data encryption
- File system encryption for uploaded media
- Backup encryption with separate keys

**Data Encryption in Transit**:
- TLS 1.3 for all API communications
- Certificate pinning for mobile applications
- HSTS headers for web applications

**Key Management**:
- Hardware Security Module (HSM) for production keys
- Key rotation every 90 days
- Separate keys for different environments

---

## 10. Security & Compliance

### 10.1 Security Architecture

#### 10.1.1 Defense in Depth

**Layer 1: Network Security**
- WAF (Web Application Firewall)
- DDoS protection
- IP whitelisting for admin access
- VPN access for internal systems

**Layer 2: Application Security**
- Input validation and sanitization
- Output encoding
- CSRF protection
- XSS prevention

**Layer 3: Authentication & Authorization**
- Multi-factor authentication
- JWT with short expiry
- Role-based access control
- Session management

**Layer 4: Data Security**
- Field-level encryption
- Database encryption
- Secure key management
- Data masking for non-production

#### 10.1.2 Security Controls

**Access Controls**:
```javascript
// Role-based access control
const roles = {
  user: ['read:own_profile', 'update:own_profile'],
  moderator: ['read:any_profile', 'moderate:content'],
  admin: ['read:any_profile', 'update:any_profile', 'delete:any_profile'],
  super_admin: ['*'],
};

// Permission checking
function hasPermission(userRoles, requiredPermission) {
  return userRoles.some(role => 
    roles[role].includes(requiredPermission) || roles[role].includes('*')
  );
}
```

**Data Classification**:
```javascript
const dataClassification = {
  public: ['display_name', 'avatar_url', 'is_verified'],
  internal: ['phone', 'email', 'last_login'],
  confidential: ['password_hash', 'verification_data'],
  restricted: ['government_id', 'financial_data'],
};
```

### 10.2 Compliance Framework

#### 10.2.1 PIPL Compliance

**Personal Information Protection Law Requirements**:

1. **Consent Management**:
```javascript
const consentTypes = {
  data_processing: 'Processing of personal information',
  marketing: 'Marketing communications',
  data_sharing: 'Sharing data with third parties',
  profiling: 'Automated decision making and profiling',
};

// Consent tracking
class ConsentManager {
  static async recordConsent(userId, consentType, granted) {
    await AuditLog.logAction({
      userId,
      action: 'consent_recorded',
      resource: 'user_consent',
      newValues: {
        consent_type: consentType,
        granted,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

2. **Data Minimization**:
```javascript
// Only collect necessary data
const minimumRequiredFields = ['phone', 'password'];
const optionalFields = ['display_name', 'bio', 'avatar_url'];

function validateDataCollection(userData) {
  // Ensure only necessary data is collected
  const allowedFields = [...minimumRequiredFields, ...optionalFields];
  const providedFields = Object.keys(userData);
  
  const unauthorizedFields = providedFields.filter(
    field => !allowedFields.includes(field)
  );
  
  if (unauthorizedFields.length > 0) {
    throw new Error(`Unauthorized data collection: ${unauthorizedFields.join(', ')}`);
  }
}
```

3. **Data Subject Rights**:
```javascript
class DataSubjectRights {
  // Right to access
  static async exportUserData(userId) {
    return await complianceService.exportUserData(userId, {
      format: 'json',
      include_deleted: false,
    });
  }
  
  // Right to rectification
  static async updateUserData(userId, updates) {
    return await profileService.updateUserProfile(userId, updates);
  }
  
  // Right to erasure
  static async deleteUserData(userId) {
    return await settingsService.requestAccountDeletion(userId);
  }
  
  // Right to data portability
  static async portUserData(userId, format = 'json') {
    return await complianceService.exportUserData(userId, { format });
  }
}
```

#### 10.2.2 Cybersecurity Law Compliance

**Security Incident Response**:
```javascript
class IncidentResponse {
  static async reportSecurityIncident(incident) {
    // Log incident
    logger.security('Security incident reported', incident);
    
    // Store in audit log
    await AuditLog.logAction({
      action: 'security_incident',
      resource: 'security',
      newValues: incident,
    });
    
    // Notify security team
    await this.notifySecurityTeam(incident);
    
    // If critical, notify authorities within 72 hours
    if (incident.severity === 'critical') {
      await this.scheduleAuthorityNotification(incident);
    }
  }
  
  static async notifySecurityTeam(incident) {
    // Send alert to security team
  }
  
  static async scheduleAuthorityNotification(incident) {
    // Schedule notification to relevant authorities
  }
}
```

#### 10.2.3 Data Security Law Compliance

**Data Classification and Protection**:
```javascript
class DataClassificationService {
  static classifyData(data) {
    const classification = {
      level: 'public',
      categories: [],
      protection_requirements: [],
    };
    
    // Classify based on data content
    if (data.phone || data.email) {
      classification.level = 'personal';
      classification.categories.push('contact_information');
      classification.protection_requirements.push('encryption_at_rest');
    }
    
    if (data.government_id || data.financial_data) {
      classification.level = 'sensitive';
      classification.categories.push('identity_information');
      classification.protection_requirements.push('encryption_in_transit', 'access_logging');
    }
    
    return classification;
  }
  
  static async applyProtection(data, classification) {
    if (classification.protection_requirements.includes('encryption_at_rest')) {
      data = await encryptionService.encryptUserData(data);
    }
    
    return data;
  }
}
```

### 10.3 Audit and Monitoring

#### 10.3.1 Compliance Reporting

**Automated Compliance Reports**:
```javascript
class ComplianceReporting {
  static async generateMonthlyReport() {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    
    const endDate = new Date();
    endDate.setDate(0);
    
    const report = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      pipl_compliance: await this.generatePIPLReport(startDate, endDate),
      cybersecurity_compliance: await this.generateCybersecurityReport(startDate, endDate),
      data_security_compliance: await this.generateDataSecurityReport(startDate, endDate),
    };
    
    // Store report
    await this.storeComplianceReport(report);
    
    // Send to compliance team
    await this.sendComplianceReport(report);
    
    return report;
  }
}
```

#### 10.3.2 Real-time Monitoring

**Security Dashboard Metrics**:
```javascript
const securityMetrics = {
  failed_login_attempts: new promClient.Counter({
    name: 'failed_login_attempts_total',
    help: 'Total number of failed login attempts',
    labelNames: ['ip_address', 'user_agent'],
  }),
  
  suspicious_activities: new promClient.Counter({
    name: 'suspicious_activities_total',
    help: 'Total number of suspicious activities detected',
    labelNames: ['activity_type', 'severity'],
  }),
  
  data_access_events: new promClient.Counter({
    name: 'data_access_events_total',
    help: 'Total number of data access events',
    labelNames: ['data_type', 'access_type'],
  }),
};
```

---

This comprehensive documentation provides a complete overview of the Lianxin project, covering every file, API endpoint, dependency relationship, and integration strategy. The documentation serves as both a technical reference and implementation guide for developers working on the platform.