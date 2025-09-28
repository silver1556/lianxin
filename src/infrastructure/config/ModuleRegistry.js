/**
 * Module Registry
 * Manages module registration and lifecycle with dependency validation
 */
class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.initializationOrder = [];
    this.isInitialized = false;
    this.moduleContracts = new Map();
  }

  /**
   * Register a module with its contract
   */
  register(name, moduleClass, dependencies = [], contractName = null) {
    this.modules.set(name, {
      name,
      moduleClass,
      dependencies,
      contract: contractName,
      instance: null,
      initialized: false
    });

    return this;
  }

  /**
   * Register module contract
   */
  registerModuleContract(name, contractClass) {
    this.moduleContracts.set(name, contractClass);
    return this;
  }

  /**
   * Initialize all modules in dependency order
   */
  async initializeAll(container) {
    if (this.isInitialized) {
      return this;
    }

    try {
      // Validate container has all required contracts
      await this._validateContainerContracts(container);

      // Resolve dependency order
      const initOrder = this._resolveDependencyOrder();
      
      console.log('Module initialization order:', initOrder);

      // Initialize modules in order
      for (const moduleName of initOrder) {
        await this._initializeModule(moduleName, container);
      }

      // Validate all modules implement their contracts
      await this._validateModuleContracts();

      this.isInitialized = true;
      console.log('All modules initialized successfully');

      return this;

    } catch (error) {
      console.error('Module initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get module instance
   */
  getModule(name) {
    const moduleInfo = this.modules.get(name);
    if (!moduleInfo) {
      throw new Error(`Module '${name}' not registered`);
    }

    if (!moduleInfo.initialized) {
      throw new Error(`Module '${name}' not initialized`);
    }

    return moduleInfo.instance;
  }

  /**
   * Get all initialized modules
   */
  getAllModules() {
    const result = {};
    for (const [name, moduleInfo] of this.modules.entries()) {
      if (moduleInfo.initialized) {
        result[name] = moduleInfo.instance;
      }
    }
    return result;
  }

  /**
   * Get module health status
   */
  async getModuleHealth(name) {
    const moduleInfo = this.modules.get(name);
    if (!moduleInfo || !moduleInfo.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      return await moduleInfo.instance.getHealthStatus();
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Get all modules health status
   */
  async getAllModulesHealth() {
    const health = {};
    
    for (const [name, moduleInfo] of this.modules.entries()) {
      health[name] = await this.getModuleHealth(name);
    }

    return health;
  }

  /**
   * Shutdown all modules
   */
  async shutdownAll() {
    console.log('Shutting down all modules...');

    // Shutdown in reverse order
    const shutdownOrder = [...this.initializationOrder].reverse();

    for (const moduleName of shutdownOrder) {
      const moduleInfo = this.modules.get(moduleName);
      if (moduleInfo && moduleInfo.initialized && moduleInfo.instance.shutdown) {
        try {
          await moduleInfo.instance.shutdown();
          moduleInfo.initialized = false;
          console.log(`Module '${moduleName}' shut down successfully`);
        } catch (error) {
          console.error(`Failed to shutdown module '${moduleName}':`, error);
        }
      }
    }

    this.isInitialized = false;
  }

  /**
   * Get module dependency graph
   */
  getDependencyGraph() {
    const graph = {};
    
    for (const [name, moduleInfo] of this.modules.entries()) {
      graph[name] = {
        dependencies: moduleInfo.dependencies,
        contract: moduleInfo.contract,
        initialized: moduleInfo.initialized
      };
    }

    return graph;
  }

  // Private methods
  async _initializeModule(name, container) {
    const moduleInfo = this.modules.get(name);
    if (!moduleInfo) {
      throw new Error(`Module '${name}' not found`);
    }

    if (moduleInfo.initialized) {
      return moduleInfo.instance;
    }

    console.log(`Initializing module: ${name}`);

    try {
      // Resolve module dependencies
      const moduleDependencies = await container.resolveAll(moduleInfo.dependencies);

      // Create module instance
      const moduleInstance = new moduleInfo.moduleClass();

      // Initialize module
      await moduleInstance.initialize(moduleDependencies);

      // Validate module contract if specified
      if (moduleInfo.contract && this.moduleContracts.has(moduleInfo.contract)) {
        const contractClass = this.moduleContracts.get(moduleInfo.contract);
        if (!(moduleInstance instanceof contractClass)) {
          throw new Error(`Module '${name}' does not implement contract '${moduleInfo.contract}'`);
        }
      }

      // Store instance
      moduleInfo.instance = moduleInstance;
      moduleInfo.initialized = true;

      // Add to initialization order
      this.initializationOrder.push(name);

      console.log(`Module '${name}' initialized successfully`);

      return moduleInstance;

    } catch (error) {
      console.error(`Failed to initialize module '${name}':`, error);
      throw error;
    }
  }

  _resolveDependencyOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (moduleName) => {
      if (visiting.has(moduleName)) {
        throw new Error(`Circular dependency detected involving module '${moduleName}'`);
      }

      if (visited.has(moduleName)) {
        return;
      }

      visiting.add(moduleName);

      const moduleInfo = this.modules.get(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module '${moduleName}' not found`);
      }

      // Visit dependencies first
      for (const dependency of moduleInfo.dependencies) {
        // Only visit if it's a module dependency
        if (this.modules.has(dependency)) {
          visit(dependency);
        }
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      order.push(moduleName);
    };

    // Visit all modules
    for (const moduleName of this.modules.keys()) {
      visit(moduleName);
    }

    return order;
  }

  async _validateContainerContracts(container) {
    try {
      await container.validateContracts();
    } catch (error) {
      throw new Error(`Container contract validation failed: ${error.message}`);
    }
  }

  async _validateModuleContracts() {
    const errors = [];

    for (const [name, moduleInfo] of this.modules.entries()) {
      if (moduleInfo.contract && this.moduleContracts.has(moduleInfo.contract)) {
        const contractClass = this.moduleContracts.get(moduleInfo.contract);
        
        if (!(moduleInfo.instance instanceof contractClass)) {
          errors.push(`Module '${name}' does not implement contract '${moduleInfo.contract}'`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Module contract validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }
}

module.exports = ModuleRegistry;