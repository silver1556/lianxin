const DependencyContainer = require('./DependencyContainer');
const ModuleRegistry = require('./ModuleRegistry');

// Modules
const UserModule = require('../../modules/user/UserModule');
const MediaModule = require('../../modules/media/MediaModule');
const LocationModule = require('../../modules/location/LocationModule');

// Adapters
const RedisAdapter = require('../adapters/cache/RedisAdapter');
const CryptoEncryptionAdapter = require('../adapters/encryption/CryptoEncryptionAdapter');

// Services
const PasswordService = require('../services/PasswordService');
const PhoneService = require('../services/PhoneService');
const JwtService = require('../services/JwtService');

/**
 * Application Bootstrap
 * Sets up dependency injection and module registration
 */
class Bootstrap {
  constructor() {
    this.container = new DependencyContainer();
    this.moduleRegistry = new ModuleRegistry();
  }

  /**
   * Configure all dependencies
   */
  async configureDependencies(config, database, redisClient) {
    // Register core infrastructure
    this.container
      .registerInstance('config', config)
      .registerInstance('database', database)
      .registerInstance('redisClient', redisClient)

      // Register adapters
      .registerSingleton('cacheAdapter', async (container) => {
        const redis = await container.resolve('redisClient');
        const config = await container.resolve('config');
        return new RedisAdapter(redis, config);
      })

      .registerSingleton('encryptionAdapter', async (container) => {
        const config = await container.resolve('config');
        return new CryptoEncryptionAdapter(config);
      })

      // Register services
      .registerSingleton('passwordService', async (container) => {
        const config = await container.resolve('config');
        return new PasswordService(config);
      })

      .registerSingleton('phoneService', async (container) => {
        const config = await container.resolve('config');
        return new PhoneService(config);
      })

      .registerSingleton('jwtService', async (container) => {
        const config = await container.resolve('config');
        const encryption = await container.resolve('encryptionAdapter');
        return new JwtService(config, encryption);
      });

    return this;
  }

  /**
   * Register all modules
   */
  registerModules() {
    this.moduleRegistry
      .register('user', UserModule, [
        'database',
        'redisClient',
        'config',
        'cacheAdapter',
        'encryptionAdapter',
        'passwordService',
        'phoneService',
        'jwtService'
      ])
      .register('media', MediaModule, [
        'database',
        'cacheAdapter',
        'config'
      ])
      .register('location', LocationModule, [
        'cacheAdapter',
        'config'
      ]);

    return this;
  }

  /**
   * Initialize application
   */
  async initialize(config, database, redisClient) {
    try {
      console.log('Bootstrapping application...');

      // Configure dependencies
      await this.configureDependencies(config, database, redisClient);

      // Register modules
      this.registerModules();

      // Initialize all modules
      await this.moduleRegistry.initializeAll(this.container);

      console.log('Application bootstrap completed successfully');

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
        modules: moduleHealth,
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
}

module.exports = Bootstrap;