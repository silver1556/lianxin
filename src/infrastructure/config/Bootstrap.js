const DependencyContainer = require('./DependencyContainer');
const ModuleRegistry = require('./ModuleRegistry');

// Contracts
const CacheService = require('../../core/domain/shared/contracts/CacheService');
const EncryptionService = require('../../core/domain/shared/contracts/EncryptionService');
const EventPublisher = require('../../core/domain/shared/contracts/EventPublisher');
const UserRepository = require('../../core/domain/user/contracts/UserRepository');
const SessionRepository = require('../../core/domain/user/contracts/SessionRepository');
const OtpService = require('../../core/domain/user/contracts/OtpService');
const PasswordService = require('../../core/domain/user/contracts/PasswordService');
const PhoneService = require('../../core/domain/user/contracts/PhoneService');
const JwtService = require('../../core/domain/user/contracts/JwtService');

// Modules
const UserModule = require('../../modules/user/UserModule');
const LocationModule = require('../../modules/location/LocationModule');
const PlaceModule = require('../../modules/place/PlaceModule');
const MediaModule = require('../../modules/media/MediaModule');

// Adapters
const RedisCacheAdapter = require('../adapters/cache/RedisCacheAdapter');
const CryptoEncryptionAdapter = require('../adapters/encryption/CryptoEncryptionAdapter');
const InMemoryEventAdapter = require('../adapters/events/InMemoryEventAdapter');
const UserMySQLAdapter = require('../adapters/persistence/UserMySQLAdapter');
const SessionMySQLAdapter = require('../adapters/persistence/SessionMySQLAdapter');
const MockOtpAdapter = require('../adapters/external/MockOtpAdapter');

// Services
const PasswordServiceImpl = require('../services/PasswordServiceImpl');
const PhoneServiceImpl = require('../services/PhoneServiceImpl');
const JwtServiceImpl = require('../services/JwtServiceImpl');

/**
 * Application Bootstrap
 * Sets up dependency injection and module registration with contracts
 */
class Bootstrap {
  constructor() {
    this.container = new DependencyContainer();
    this.moduleRegistry = new ModuleRegistry();
  }

  /**
   * Configure all dependencies with contracts
   */
  async configureDependencies(config, database, redisClient) {
    // Register contracts first
    this.container
      .registerContract('CacheService', CacheService)
      .registerContract('EncryptionService', EncryptionService)
      .registerContract('EventPublisher', EventPublisher)
      .registerContract('UserRepository', UserRepository)
      .registerContract('SessionRepository', SessionRepository)
      .registerContract('OtpService', OtpService)
      .registerContract('PasswordService', PasswordService)
      .registerContract('PhoneService', PhoneService)
      .registerContract('JwtService', JwtService);

    // Register core infrastructure
    this.container
      .registerInstance('config', config)
      .registerInstance('database', database)
      .registerInstance('redisClient', redisClient)

      // Register adapters with their contracts
      .registerSingleton('cacheService', async (container) => {
        const redis = await container.resolve('redisClient');
        const config = await container.resolve('config');
        return new RedisCacheAdapter(redis, config);
      }, 'CacheService')

      .registerSingleton('encryptionService', async (container) => {
        const config = await container.resolve('config');
        return new CryptoEncryptionAdapter(config);
      }, 'EncryptionService')

      .registerSingleton('eventPublisher', async (container) => {
        return new InMemoryEventAdapter();
      }, 'EventPublisher')

      .registerSingleton('userRepository', async (container) => {
        const database = await container.resolve('database');
        const encryptionService = await container.resolve('encryptionService');
        return new UserMySQLAdapter(database.sequelize, database, encryptionService);
      }, 'UserRepository')

      .registerSingleton('sessionRepository', async (container) => {
        const database = await container.resolve('database');
        const encryptionService = await container.resolve('encryptionService');
        return new SessionMySQLAdapter(database.sequelize, database, encryptionService);
      }, 'SessionRepository')

      .registerSingleton('otpService', async (container) => {
        const cacheService = await container.resolve('cacheService');
        const config = await container.resolve('config');
        return new MockOtpAdapter(cacheService, config);
      }, 'OtpService')

      // Register domain services with their contracts
      .registerSingleton('passwordService', async (container) => {
        const config = await container.resolve('config');
        return new PasswordServiceImpl(config);
      }, 'PasswordService')

      .registerSingleton('phoneService', async (container) => {
        const config = await container.resolve('config');
        return new PhoneServiceImpl(config);
      }, 'PhoneService')

      .registerSingleton('jwtService', async (container) => {
        const config = await container.resolve('config');
        const encryptionService = await container.resolve('encryptionService');
        return new JwtServiceImpl(config, encryptionService);
      }, 'JwtService');

    return this;
  }

  /**
   * Register all modules with their dependencies
   */
  registerModules() {
    this.moduleRegistry
      .register('user', UserModule, [
        'database',
        'redisClient',
        'config',
        'cacheService',
        'encryptionService',
        'eventPublisher',
        'userRepository',
        'sessionRepository',
        'otpService',
        'passwordService',
        'phoneService',
        'jwtService'
      ])
      .register('location', LocationModule, [
        'cacheService',
        'config'
      ])
      .register('place', PlaceModule, [
        'database',
        'cacheService',
        'config'
      ])
      .register('media', MediaModule, [
        'database',
        'cacheService',
        'encryptionService',
        'config'
      ]);

    return this;
  }

  /**
   * Initialize application
   */
  async initialize(config, database, redisClient) {
    try {
      console.log('Bootstrapping application with Hexagonal Architecture...');

      // Configure dependencies with contracts
      await this.configureDependencies(config, database, redisClient);

      // Validate all contracts are properly implemented
      await this.container.validateContracts();
      console.log('All dependency contracts validated successfully');

      // Register modules
      this.registerModules();

      // Initialize all modules
      await this.moduleRegistry.initializeAll(this.container);

      console.log('Application bootstrap completed successfully');
      console.log('Dependency info:', this.container.getDependencyInfo());
      console.log('Module dependency graph:', this.moduleRegistry.getDependencyGraph());

      return {
        container: this.container,
        moduleRegistry: this.moduleRegistry
      };

    } catch (error) {
      console.error('Application bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Get application health
   */
  async getHealth() {
    try {
      const moduleHealth = await this.moduleRegistry.getAllModulesHealth();
      
      const overallHealthy = Object.values(moduleHealth).every(
        health => health.status === 'healthy'
      );

      return {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        architecture: 'hexagonal',
        modules: moduleHealth,
        dependencies: this.container.getDependencyInfo(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Shutdown application
   */
  async shutdown() {
    console.log('Shutting down application...');
    
    try {
      await this.moduleRegistry.shutdownAll();
      this.container.clear();
      console.log('Application shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  // Private helper methods
  async _validateContainerContracts(container) {
    const requiredContracts = [
      'CacheService',
      'EncryptionService',
      'EventPublisher',
      'UserRepository',
      'SessionRepository',
      'OtpService',
      'PasswordService',
      'PhoneService',
      'JwtService'
    ];

    const registeredContracts = container.getRegisteredContracts();
    const missingContracts = requiredContracts.filter(
      contract => !registeredContracts.includes(contract)
    );

    if (missingContracts.length > 0) {
      throw new Error(`Missing required contracts: ${missingContracts.join(', ')}`);
    }
  }

  async _validateModuleContracts() {
    // Module contract validation would be implemented here
    // For now, we assume modules implement a basic interface
    return true;
  }
}

module.exports = Bootstrap;