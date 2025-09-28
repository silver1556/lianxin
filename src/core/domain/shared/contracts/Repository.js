/**
 * Base Repository Contract
 * Defines common repository operations
 */
class Repository {
  /**
   * Find entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<Entity|null>}
   */
  async findById(id) {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Save entity
   * @param {Entity} entity - Entity to save
   * @returns {Promise<Entity>}
   */
  async save(entity) {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Delete entity
   * @param {string|number} id - Entity ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Find entities with filters
   * @param {Object} filters - Search filters
   * @param {Object} options - Query options (pagination, sorting)
   * @returns {Promise<{entities: Entity[], total: number}>}
   */
  async findWithFilters(filters, options = {}) {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Begin transaction
   * @returns {Promise<Transaction>}
   */
  async beginTransaction() {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Commit transaction
   * @param {Transaction} transaction
   * @returns {Promise<void>}
   */
  async commitTransaction(transaction) {
    throw new Error('Method must be implemented by concrete repository');
  }

  /**
   * Rollback transaction
   * @param {Transaction} transaction
   * @returns {Promise<void>}
   */
  async rollbackTransaction(transaction) {
    throw new Error('Method must be implemented by concrete repository');
  }
}

module.exports = Repository;