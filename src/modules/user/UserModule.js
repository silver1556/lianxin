const UserApplicationService = require('../../core/application/user/services/UserApplicationService');
const AuthenticationApplicationService = require('../../core/application/user/services/AuthenticationApplicationService');

// Adapters
const UserMySQLAdapter = require('../../infrastructure/adapters/persistence/mysql/UserMySQLAdapter');
const SessionMySQLAdapter = require('../../infrastructure/adapters/persistence/mysql/SessionMySQLAdapter');
const RedisAdapter = require('../../infrastructure/adapters/cache/RedisAdapter');
const CryptoEncryptionAdapter = require('../../infrastructure/adapters/encryption/CryptoEncryptionAdapter');
const InMemoryEventAdapter = require('../../infrastructure/adapters/events/InMemoryEventAdapter');
const MockOtpAdapter = require('../../infrastructure/adapters/external/MockOtpAdapter');

// Controllers
const UserController = require('./controllers/UserController');
const AuthController = require('./controllers/AuthController');

// Routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

/**
 * User Module
 * Bounded Context for User Management
 */
class UserModule {
  constructor() {
    this.name = 'UserModule';
    this.isInitialized = false;
    this.dependencies = {};
    this.services = {};
    this.controllers = {};
    this.routes = {};
  }

  /**
   * Initialize the User Module with dependency injection
   */
  async initialize(dependencies) {
    if (this.isInitialized) {
      return this;
    }

    try {
      // Store dependencies
      this.dependencies = dependencies;

      // Initialize adapters
      await this._initializeAdapters();

      // Initialize application services
      await this._initializeApplicationServices();

      // Initialize controllers
      await this._initializeControllers();

      // Initialize routes
      await this._initializeRoutes();

      this.isInitialized = true;

      console.log('User Module initialized successfully');
      return this;

    } catch (error) {
      console.error('User Module initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get module router
   */
  getRouter() {
    if (!this.isInitialized) {
      throw new Error('User Module not initialized');
    }

    const express = require('express');
    const router = express.Router();

    // Mount routes
    router.use('/auth', this.routes.auth);
    router.use('/user', this.routes.user);

    return router;
  }

  /**
   * Get module health status
   */
  async getHealthStatus() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    try {
      // Check database connectivity
      const dbHealth = await this.dependencies.database.testConnection();
      
      // Check cache connectivity
      const cacheHealth = await this.adapters.cache.ping() === 'PONG';

      const isHealthy = dbHealth && cacheHealth;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        database: dbHealth,
        cache: cacheHealth,
        initialized: this.isInitialized
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Shutdown module
   */
  async shutdown() {
    console.log('Shutting down User Module...');
    this.isInitialized = false;
  }

  // Private initialization methods
  async _initializeAdapters() {
    this.adapters = {
      userRepository: new UserMySQLAdapter(
        this.dependencies.database.sequelize,
        this.dependencies.database.models,
        this.dependencies.encryptionService
      ),
      sessionRepository: new SessionMySQLAdapter(
        this.dependencies.database.sequelize,
        this.dependencies.database.models,
        this.dependencies.encryptionService
      ),
      cache: new RedisAdapter(
        this.dependencies.redisClient,
        this.dependencies.config
      ),
      encryption: new CryptoEncryptionAdapter(this.dependencies.config),
      eventPublisher: new InMemoryEventAdapter(),
      otpService: new MockOtpAdapter(
        new RedisAdapter(this.dependencies.redisClient, this.dependencies.config),
        this.dependencies.config
      )
    };
  }

  async _initializeApplicationServices() {
    this.services = {
      user: new UserApplicationService({
        userRepository: this.adapters.userRepository,
        sessionRepository: this.adapters.sessionRepository,
        encryptionService: this.adapters.encryption,
        cacheService: this.adapters.cache,
        eventPublisher: this.adapters.eventPublisher,
        otpService: this.adapters.otpService,
        passwordService: this.dependencies.passwordService,
        phoneService: this.dependencies.phoneService
      }),
      authentication: new AuthenticationApplicationService({
        userRepository: this.adapters.userRepository,
        sessionRepository: this.adapters.sessionRepository,
        encryptionService: this.adapters.encryption,
        cacheService: this.adapters.cache,
        eventPublisher: this.adapters.eventPublisher,
        otpService: this.adapters.otpService,
        passwordService: this.dependencies.passwordService,
        phoneService: this.dependencies.phoneService,
        jwtService: this.dependencies.jwtService
      })
    };
  }

  async _initializeControllers() {
    this.controllers = {
      user: new UserController(this.services.user),
      auth: new AuthController(this.services.authentication)
    };
  }

  async _initializeRoutes() {
    this.routes = {
      user: userRoutes(this.controllers.user),
      auth: authRoutes(this.controllers.auth)
    };
  }
}

module.exports = UserModule;