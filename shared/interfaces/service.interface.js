// shared/interfaces/service.interface.js

/**
 * Standard Service Interface
 * All services should implement this interface for consistency
 */
class ServiceInterface {
  constructor(serviceName) {
    if (new.target === ServiceInterface) {
      throw new Error(
        "ServiceInterface is abstract and cannot be instantiated directly"
      );
    }
    this.serviceName = serviceName;
    this.isInitialized = false;
  }

  /**
   * Initialize the service and all its dependencies
   * @returns {Promise<{success: boolean, services?: object, capabilities?: object}>}
   */
  async initialize() {
    throw new Error("initialize() method must be implemented by subclass");
  }

  /**
   * Get the Express router for this service
   * @returns {express.Router}
   */
  getRouter() {
    throw new Error("getRouter() method must be implemented by subclass");
  }

  /**
   * Check if the service is ready to handle requests
   * @returns {boolean}
   */
  isReady() {
    throw new Error("isReady() method must be implemented by subclass");
  }

  /**
   * Get detailed health status of the service
   * @returns {Promise<object>}
   */
  async getHealthStatus() {
    throw new Error("getHealthStatus() method must be implemented by subclass");
  }

  /**
   * Get service status for monitoring
   * @returns {object}
   */
  getStatus() {
    throw new Error("getStatus() method must be implemented by subclass");
  }

  /**
   * Get service capabilities
   * @returns {object}
   */
  getCapabilities() {
    throw new Error("getCapabilities() method must be implemented by subclass");
  }

  /**
   * Graceful shutdown of the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error("shutdown() method must be implemented by subclass");
  }
}

module.exports = ServiceInterface;
