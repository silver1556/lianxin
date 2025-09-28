/**
 * Dependency Injection Container
 * Manages all dependencies and their lifecycles using contracts
 */
class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.contracts = new Map();
  }

  /**
   * Register a contract interface
   */
  registerContract(name, contractClass) {
    this.contracts.set(name, contractClass);
    return this;
  }

  /**
   * Register a singleton dependency
   */
  registerSingleton(name, factory, contractName = null) {
    this.factories.set(name, { 
      type: 'singleton', 
      factory,
      contract: contractName 
    });
    return this;
  }

  /**
   * Register a transient dependency
   */
  registerTransient(name, factory, contractName = null) {
    this.factories.set(name, { 
      type: 'transient', 
      factory,
      contract: contractName 
    });
    return this;
  }

  /**
   * Register an instance
   */
  registerInstance(name, instance, contractName = null) {
    // Validate contract if specified
    if (contractName && this.contracts.has(contractName)) {
      const contractClass = this.contracts.get(contractName);
      if (!(instance instanceof contractClass)) {
        throw new Error(`Instance does not implement contract ${contractName}`);
      }
    }

    this.dependencies.set(name, instance);
    return this;
  }

  /**
   * Resolve dependency
   */
  async resolve(name) {
    // Check if already resolved
    if (this.dependencies.has(name)) {
      return this.dependencies.get(name);
    }

    // Check if singleton already created
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Get factory
    const factoryInfo = this.factories.get(name);
    if (!factoryInfo) {
      throw new Error(`Dependency '${name}' not registered`);
    }

    // Create instance
    const instance = await factoryInfo.factory(this);

    // Validate contract if specified
    if (factoryInfo.contract && this.contracts.has(factoryInfo.contract)) {
      const contractClass = this.contracts.get(factoryInfo.contract);
      if (!(instance instanceof contractClass)) {
        throw new Error(`Instance '${name}' does not implement contract '${factoryInfo.contract}'`);
      }
    }

    // Store singleton
    if (factoryInfo.type === 'singleton') {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Resolve multiple dependencies
   */
  async resolveAll(names) {
    const resolved = {};
    for (const name of names) {
      resolved[name] = await this.resolve(name);
    }
    return resolved;
  }

  /**
   * Check if dependency is registered
   */
  isRegistered(name) {
    return this.dependencies.has(name) || 
           this.singletons.has(name) || 
           this.factories.has(name);
  }

  /**
   * Get all registered dependency names
   */
  getRegisteredNames() {
    const names = new Set();
    
    for (const name of this.dependencies.keys()) names.add(name);
    for (const name of this.singletons.keys()) names.add(name);
    for (const name of this.factories.keys()) names.add(name);
    
    return Array.from(names);
  }

  /**
   * Get registered contracts
   */
  getRegisteredContracts() {
    return Array.from(this.contracts.keys());
  }

  /**
   * Validate all dependencies implement their contracts
   */
  async validateContracts() {
    const errors = [];

    for (const [name, factoryInfo] of this.factories.entries()) {
      if (factoryInfo.contract && this.contracts.has(factoryInfo.contract)) {
        try {
          const instance = await this.resolve(name);
          const contractClass = this.contracts.get(factoryInfo.contract);
          
          if (!(instance instanceof contractClass)) {
            errors.push(`Dependency '${name}' does not implement contract '${factoryInfo.contract}'`);
          }
        } catch (error) {
          errors.push(`Failed to validate contract for '${name}': ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Contract validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Clear all dependencies (for testing)
   */
  clear() {
    this.dependencies.clear();
    this.singletons.clear();
    this.factories.clear();
    this.contracts.clear();
  }

  /**
   * Create child container with inherited dependencies
   */
  createChild() {
    const child = new DependencyContainer();
    
    // Copy contracts
    for (const [name, contract] of this.contracts.entries()) {
      child.contracts.set(name, contract);
    }
    
    // Copy factories
    for (const [name, factory] of this.factories.entries()) {
      child.factories.set(name, factory);
    }
    
    // Copy instances
    for (const [name, instance] of this.dependencies.entries()) {
      child.dependencies.set(name, instance);
    }
    
    return child;
  }

  /**
   * Get dependency info for debugging
   */
  getDependencyInfo() {
    return {
      contracts: Array.from(this.contracts.keys()),
      instances: Array.from(this.dependencies.keys()),
      singletons: Array.from(this.singletons.keys()),
      factories: Array.from(this.factories.keys()).map(name => ({
        name,
        type: this.factories.get(name).type,
        contract: this.factories.get(name).contract
      }))
    };
  }
}

module.exports = DependencyContainer;