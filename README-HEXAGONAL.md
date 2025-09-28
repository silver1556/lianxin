# Lianxin Platform - Hexagonal Architecture

This document describes the new Hexagonal/Ports & Adapters architecture implementation for the Lianxin social media platform.

## Architecture Overview

The platform now follows **Hexagonal Architecture** (also known as Ports & Adapters) with a **Modular Monolith** structure organized by **Bounded Contexts**.

### Key Principles

1. **Hexagonal/Ports & Adapters**: Core domain logic is isolated from infrastructure concerns
2. **Dependency Injection**: All dependencies are injected via interfaces/contracts
3. **Modular Monolith**: Each business domain is a self-contained module
4. **Event-Driven Architecture**: Modules communicate via domain events for async side-effects
5. **Contract-Based Design**: All adapters implement well-defined contracts

## Directory Structure

```
src/
├── core/                           # Core domain layer
│   ├── domain/                     # Domain entities and business logic
│   │   ├── shared/                 # Shared domain concepts
│   │   │   ├── contracts/          # Domain service contracts
│   │   │   │   ├── Repository.js
│   │   │   │   ├── CacheService.js
│   │   │   │   ├── EncryptionService.js
│   │   │   │   └── EventPublisher.js
│   │   │   └── events/
│   │   │       └── DomainEvent.js
│   │   └── user/                   # User bounded context
│   │       ├── contracts/          # User-specific contracts
│   │       │   ├── UserRepository.js
│   │       │   ├── SessionRepository.js
│   │       │   ├── OtpService.js
│   │       │   ├── PasswordService.js
│   │       │   ├── PhoneService.js
│   │       │   └── JwtService.js
│   │       └── entities/           # Domain entities
│   │           ├── User.js
│   │           ├── UserSession.js
│   │           └── UserProfile.js
│   └── application/                # Application services layer
│       └── user/
│           └── services/
│               ├── AuthenticationApplicationService.js
│               └── UserApplicationService.js
├── infrastructure/                 # Infrastructure layer
│   ├── adapters/                   # Concrete implementations
│   │   ├── persistence/            # Database adapters
│   │   │   ├── UserMySQLAdapter.js
│   │   │   └── SessionMySQLAdapter.js
│   │   ├── cache/                  # Cache adapters
│   │   │   └── RedisCacheAdapter.js
│   │   ├── encryption/             # Encryption adapters
│   │   │   └── CryptoEncryptionAdapter.js
│   │   ├── events/                 # Event adapters
│   │   │   └── InMemoryEventAdapter.js
│   │   └── external/               # External service adapters
│   │       └── MockOtpAdapter.js
│   ├── services/                   # Infrastructure services
│   │   ├── PasswordServiceImpl.js
│   │   ├── PhoneServiceImpl.js
│   │   └── JwtServiceImpl.js
│   └── config/                     # Configuration
│       ├── Bootstrap.js
│       ├── DependencyContainer.js
│       └── ModuleRegistry.js
└── modules/                        # Bounded context modules
    ├── user/                       # User module
    │   ├── controllers/
    │   │   ├── AuthController.js
    │   │   ├── UserController.js
    │   │   ├── SessionController.js
    │   │   └── SettingsController.js
    │   ├── middleware/
    │   │   ├── AuthenticationMiddleware.js
    │   │   └── ValidationMiddleware.js
    │   └── UserModule.js
    ├── location/                   # Location module
    │   └── LocationModule.js
    ├── place/                      # Place module
    │   └── PlaceModule.js
    └── media/                      # Media module
        └── MediaModule.js
```

## Core Concepts

### 1. Ports (Contracts/Interfaces)

Ports define the contracts that adapters must implement:

- **Repository Contracts**: Define data persistence operations
- **Service Contracts**: Define business service operations
- **Cache Contracts**: Define caching operations
- **Event Contracts**: Define event publishing operations

### 2. Adapters (Implementations)

Adapters provide concrete implementations of the ports:

- **Persistence Adapters**: MySQL, PostgreSQL, MongoDB implementations
- **Cache Adapters**: Redis, Memcached implementations
- **Event Adapters**: In-memory, Redis Pub/Sub, RabbitMQ implementations
- **External Service Adapters**: SMS, Email, Payment gateway implementations

### 3. Domain Entities

Pure business logic with no infrastructure dependencies:

- **User**: Core user business logic and rules
- **UserSession**: Session management and validation
- **UserProfile**: Profile data and privacy controls

### 4. Application Services

Orchestrate use cases using domain entities and contracts:

- **AuthenticationApplicationService**: Handles auth flows
- **UserApplicationService**: Handles user management flows

### 5. Modules (Bounded Contexts)

Self-contained business domains:

- **User Module**: Authentication, profiles, sessions
- **Location Module**: Geocoding, location services
- **Place Module**: Place management, reviews
- **Media Module**: File uploads, image processing

## Dependency Injection

All dependencies are injected via the `DependencyContainer`:

```javascript
// Register contracts
container.registerContract('UserRepository', UserRepository);

// Register implementations
container.registerSingleton('userRepository', async (container) => {
  const database = await container.resolve('database');
  const encryptionService = await container.resolve('encryptionService');
  return new UserMySQLAdapter(database, encryptionService);
}, 'UserRepository');

// Resolve dependencies
const userRepo = await container.resolve('userRepository');
```

## Event-Driven Communication

Modules communicate via domain events for async side-effects:

```javascript
// Domain entity publishes event
const loginEvent = user.recordSuccessfulLogin(ipAddress);
user.addDomainEvent(loginEvent);

// Application service publishes to event bus
await this.eventPublisher.publish(loginEvent);

// Other modules subscribe to events
await eventPublisher.subscribe('UserLoggedIn', async (event) => {
  // Handle side effects like analytics, notifications
});
```

## Benefits

### 1. **Testability**
- Easy to mock dependencies via contracts
- Domain logic can be tested in isolation
- Infrastructure can be tested separately

### 2. **Flexibility**
- Easy to swap implementations (MySQL → PostgreSQL)
- Easy to add new adapters (Redis → Memcached)
- Easy to change external services

### 3. **Maintainability**
- Clear separation of concerns
- Dependencies flow inward toward domain
- Infrastructure changes don't affect business logic

### 4. **Scalability**
- Modules can be extracted to microservices
- Clear boundaries between contexts
- Event-driven communication enables async processing

## Running the Application

### Development Mode

```bash
# Start with hexagonal architecture
node server-hexagonal.js

# Or use the original server for comparison
node server.js
```

### Docker Mode

```bash
# Development environment
make dev

# Production environment
make prod
```

## Module Communication

### Synchronous Communication
Core business flows (login, registration, session refresh) remain synchronous for consistency and immediate feedback.

### Asynchronous Communication
Side effects and cross-module communication happen via events:

- User registration → Send welcome email
- User login → Update analytics
- Profile update → Invalidate caches
- Account suspension → Send notifications

## Testing Strategy

### Unit Tests
Test domain entities and application services in isolation:

```javascript
// Test domain entity
const user = User.create({ phone: '+8613800138000', ... });
const loginEvent = user.recordSuccessfulLogin('192.168.1.1');
expect(loginEvent.getType()).toBe('UserLoggedIn');

// Test application service with mocks
const mockUserRepo = new MockUserRepository();
const authService = new AuthenticationApplicationService({
  userRepository: mockUserRepo,
  // ... other mocked dependencies
});
```

### Integration Tests
Test adapters against real infrastructure:

```javascript
// Test repository adapter
const userRepo = new UserMySQLAdapter(sequelize, models, encryptionService);
const user = await userRepo.findById(1);
expect(user).toBeInstanceOf(User);
```

### Contract Tests
Ensure adapters implement contracts correctly:

```javascript
// Test that adapter implements contract
const adapter = new UserMySQLAdapter(...);
expect(adapter).toBeInstanceOf(UserRepository);
```

## Migration Guide

### From Current Architecture

1. **Phase 1**: Run both architectures side by side
   - Use `server-hexagonal.js` for new features
   - Keep `server.js` for existing functionality

2. **Phase 2**: Gradually migrate endpoints
   - Move authentication to hexagonal architecture
   - Move user management to hexagonal architecture
   - Move other modules incrementally

3. **Phase 3**: Complete migration
   - Remove legacy server
   - Clean up old code
   - Update documentation

### Configuration

The hexagonal architecture uses the same configuration as the current system, ensuring compatibility during migration.

## Future Enhancements

### 1. **Microservices Extraction**
Modules can be easily extracted to separate services:

```javascript
// Extract user module to microservice
const userService = new UserMicroservice({
  userRepository: new UserMySQLAdapter(...),
  // ... other dependencies
});
```

### 2. **Advanced Event Sourcing**
Replace simple events with full event sourcing:

```javascript
// Event store adapter
const eventStore = new EventStoreAdapter(...);
await eventStore.append(aggregateId, events);
```

### 3. **CQRS Implementation**
Separate read and write models:

```javascript
// Command side
const commandHandler = new CreateUserCommandHandler(...);

// Query side  
const queryHandler = new GetUserQueryHandler(...);
```

This hexagonal architecture provides a solid foundation for building scalable, maintainable, and testable applications while maintaining the flexibility to evolve the system over time.