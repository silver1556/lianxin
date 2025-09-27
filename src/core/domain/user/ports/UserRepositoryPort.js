/**
 * User Repository Port (Interface)
 * Defines the contract for user data persistence
 */
class UserRepositoryPort {
  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find user by phone hash
   * @param {string} phoneHash - Hashed phone number
   * @returns {Promise<User|null>}
   */
  async findByPhoneHash(phoneHash) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find user by UUID
   * @param {string} uuid - User UUID
   * @returns {Promise<User|null>}
   */
  async findByUuid(uuid) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Save user
   * @param {User} user - User entity
   * @returns {Promise<User>}
   */
  async save(user) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Create new user
   * @param {User} user - User entity
   * @returns {Promise<User>}
   */
  async create(user) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Update user
   * @param {User} user - User entity
   * @returns {Promise<User>}
   */
  async update(user) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Delete user
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find users with filters
   * @param {Object} filters - Search filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<{users: User[], total: number}>}
   */
  async findWithFilters(filters, pagination) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Count users by status
   * @param {string} status - User status
   * @returns {Promise<number>}
   */
  async countByStatus(status) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find users scheduled for deletion
   * @param {Date} cutoffDate - Cutoff date for deletion
   * @returns {Promise<User[]>}
   */
  async findScheduledForDeletion(cutoffDate) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Begin transaction
   * @returns {Promise<Transaction>}
   */
  async beginTransaction() {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Commit transaction
   * @param {Transaction} transaction
   * @returns {Promise<void>}
   */
  async commitTransaction(transaction) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Rollback transaction
   * @param {Transaction} transaction
   * @returns {Promise<void>}
   */
  async rollbackTransaction(transaction) {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = UserRepositoryPort;