# User Service - Lianxin Social Media Platform

## Overview

The User Service is a critical microservice responsible for managing all user-related operations in the Lianxin social media platform. It provides secure user authentication, profile management, and account operations with military-grade security measures and China compliance features.

## Features

### 🔐 Authentication & Security
- Phone-based registration with OTP verification
- Dual login modes (password + OTP)
- JWT token management with refresh rotation
- Session-based security with Redis storage
- Multi-factor authentication support
- Device fingerprinting and tracking

### 👤 Profile Management
- Complete profile CRUD operations and secure avatar/cover photo upload via cloud storage
- Avatar and cover photo upload
- Privacy controls and settings
- User search and discovery
- Profile verification system

### ⚙️ Settings & Preferences
- Privacy settings management
- Notification preferences
- Display and theme settings
- Security configurations
- Content filtering options

### 🛡️ Security Features
- Field-level encryption for sensitive data
- Password strength validation with bcrypt
- Account lockout protection
- Rate limiting and abuse prevention
- Comprehensive audit logging

### 🇨🇳 China Compliance
- PIPL (Personal Information Protection Law) compliance
- Cybersecurity Law adherence
- Data Security Law compliance
- Real-name verification support
- Content moderation and filtering

### 👨‍💼 Administrative Controls
- User suspension and verification
- Comprehensive audit logging
- Compliance reporting
- Data export capabilities
- Security event monitoring

## API Endpoints

### Authentication
- `POST /api/v1/auth/register/otp` - Request OTP for registration
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login/otp` - Request OTP for login
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password/otp` - Request password reset OTP
- `POST /api/v1/auth/reset-password` - Reset password

### Profile Management
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update user profile
- `POST /api/v1/user/avatar` - Upload avatar
- `POST /api/v1/user/cover-photo` - Upload cover photo
- `GET /api/v1/user/public/:userId` - Get public user profile

### Settings
- `GET /api/v1/user/settings` - Get user settings
- `PUT /api/v1/user/settings` - Update user settings
- `PUT /api/v1/user/password-change` - Change password
- `POST /api/v1/user/phone/otp` - Request phone change OTP
- `PUT /api/v1/user/phone-number-change` - Change phone number
- `POST /api/v1/user/deactivate` - Deactivate account
- `POST /api/v1/user/request-deletion` - Request account deletion

### Session Management
- `GET /api/v1/user/sessions` - Get active sessions
- `DELETE /api/v1/user/sessions/:sessionId` - Revoke session
- `POST /api/v1/user/sessions/revoke-all` - Revoke all sessions

### Admin Endpoints
- `GET /api/v1/admin/user` - Get user list
- `GET /api/v1/admin/user/:userId` - Get user details
- `POST /api/v1/admin/user/:userId/suspend` - Suspend user
- `POST /api/v1/admin/user/:userId/unsuspend` - Unsuspend user
- `POST /api/v1/admin/user/:userId/verify` - Verify user
- `GET /api/v1/admin/stats` - Get user statistics

### Compliance
- `GET /api/v1/admin/audit-logs` - Get audit logs
- `GET /api/v1/admin/user/:userId/audit` - Get user audit trail
- `POST /api/v1/admin/compliance/report` - Generate compliance report
- `GET /api/v1/admin/user/:userId/data-export` - Export user data

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+
- Docker (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd services/user-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database setup**
```bash
# Run migrations
npm run migrate

# Seed demo data (optional)
npm run seed
```

5. **Start the service**
```bash
# Development
npm run dev

# Production
npm start
```

### Docker Setup

1. **Using Docker Compose**
```bash
docker-compose -f docker-compose.test.yml up -d
```

2. **Build and run**
```bash
docker build -t user-service .
docker run -p 3001:3001 user-service
```

## Configuration

### Environment Variables

**Note on Configuration:**
Security-related configurations are primarily managed in `src/config/security.config.js`. `src/config/app.config.js` re-exports these for convenience and includes general application settings. Ensure consistency between these files.


Key environment variables (see `.env.example` for complete list):

```bash
# Database
DB_HOST=localhost
DB_NAME=lianxin_dev
DB_USER=root
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets
JWT_ACCESS_TOKEN_SECRET=your-secret-key
JWT_REFRESH_TOKEN_SECRET=your-refresh-secret

# Encryption
ENCRYPTION_PRIMARY_KEY=your-32-char-key
```

### Security Configuration

- **Password Policy**: Minimum 8 characters with complexity requirements
- **Session Management**: 5 concurrent sessions per user maximum
- **Rate Limiting**: 1000 requests per hour per user
- **Token Expiry**: 30 minutes access token, 7 days refresh token

## Database Schema

### user Table
- User authentication and profile data
- Account status and verification
- Security tracking and audit fields

### Sessions Table
- Active user sessions with device tracking
- Session expiry and revocation management

### OTP Verifications Table
- OTP codes for various verification flows
- Rate limiting and attempt tracking

### User Settings Table
- Privacy, notification, and display preferences
- Security and content settings

### Audit Logs Table
- Comprehensive activity logging
- Compliance and security monitoring

## Security Features

### Data Protection
- **Field-level encryption** for sensitive PII data
- **Password hashing** with bcrypt (12 rounds)
- **JWT token security** with rotation and blacklisting
- **Session management** with Redis storage

### Compliance
- **PIPL compliance** with comprehensive audit trails
- **Data residency** requirements for China market
- **Content moderation** and filtering capabilities
- **Real-name verification** support

### Monitoring
- **Comprehensive logging** with structured JSON format
- **Security event tracking** for suspicious activities
- **Performance monitoring** with metrics collection
- **Audit trails** for regulatory compliance

## Development

### Project Structure
```
src/
├── controllers/     # API endpoint handlers
├── services/        # Business logic layer
├── models/          # Database models
├── middleware/      # Express middleware
├── utils/           # Helper functions
├── config/          # Configuration files
├── jobs/            # Background tasks
├── schemas/         # Validation schemas
└── errors/          # Custom error classes
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Deployment

### Production Deployment
1. Build Docker image
2. Deploy to Kubernetes cluster
3. Configure environment variables
4. Run database migrations
5. Monitor service health

### Health Checks
- `GET /health` - Service health status
- Container health checks configured
- Kubernetes readiness and liveness probes

## Monitoring & Logging

### Metrics
- API response times and error rates
- Database query performance
- Redis cache hit/miss ratios
- Session and authentication metrics

### Logging
- Structured JSON logging
- Security event logging
- Audit trail logging
- Performance monitoring

### Alerts
- High error rates
- Performance degradation
- Security incidents
- Compliance violations

## Support

For technical support or questions about the User Service:

1. Check the API documentation
2. Review the troubleshooting guide
3. Contact the development team
4. Submit issues through the project repository

## License

This project is proprietary software developed for the Lianxin social media platform.