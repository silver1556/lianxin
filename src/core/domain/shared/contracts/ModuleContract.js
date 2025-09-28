/**
 * Module Contract
 * Defines the interface that all modules must implement
 */
class ModuleContract {
  /**
   * Initialize the module with dependencies
   * @param {Object} dependencies - Injected dependencies
   * @returns {Promise<Module>}
   */
  async initialize(dependencies) {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Get the Express router for this module
   * @returns {express.Router}
   */
  getRouter() {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Check if the module is ready to handle requests
   * @returns {boolean}
   */
  isReady() {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Get detailed health status of the module
   * @returns {Promise<Object>}
   */
  async getHealthStatus() {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Get module status for monitoring
   * @returns {Object}
   */
  getStatus() {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Get module capabilities
   * @returns {Object}
   */
  getCapabilities() {
    throw new Error('Method must be implemented by concrete module');
  }

  /**
   * Graceful shutdown of the module
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error('Method must be implemented by concrete module');
  }
}

module.exports = ModuleContract;