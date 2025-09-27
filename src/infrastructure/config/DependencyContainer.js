/**
 * Dependency Injection Container
 * Manages all dependencies and their lifecycles
 */
class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
    this.factories = new Map();
  }

  /**
   * Register a singleton dependency
   */
  registerSingleton(name, factory) {
    this.factories.set(name, { type: 'singleton', factory });
    return this;
  }

  /**
   * Register a transient dependency
   */
  registerTransient(name, factory) {
    this.factories.set(name, { type: 'transient', factory });
    return this;
  }

  /**
   * Register an instance
   */
  registerInstance(name, instance) {
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
   * Clear all dependencies (for testing)
   */
  clear() {
    this.dependencies.clear();
    this.singletons.clear();
    this.factories.clear();
  }

  /**
   * Create child container with inherited dependencies
   */
  createChild() {
    const child = new DependencyContainer();
    
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
}

module.exports = DependencyContainer;