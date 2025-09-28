const Repository = require('../../shared/contracts/Repository');

/**
 * User Repository Contract
 * Defines user-specific repository operations
 */
class UserRepository extends Repository {
  /**
   * Find user by phone hash
   * @param {string} phoneHash - Hashed phone number
   * @returns {Promise<User|null>}
   */
  async findByPhoneHash(phoneHash) {
    throw new Error('Method must be implemented by concrete user repository');
  }

  /**
   * Find user by UUID
   * @param {string} uuid - User UUID
   * @returns {Promise<User|null>}
   */
  async findByUuid(uuid) {
    throw new Error('Method must be implemented by concrete user repository');
  }

  /**
   * Find users by status
   * @param {string} status - User status
   * @returns {Promise<User[]>}
   */
  async findByStatus(status) {
    throw new Error('Method must be implemented by concrete user repository');
  }

  /**
   * Count users by status
   * @param {string} status - User status
   * @returns {Promise<number>}
   */
  async countByStatus(status) {
    throw new Error('Method must be implemented by concrete user repository');
  }

  /**
   * Find users scheduled for deletion
   * @param {Date} cutoffDate - Cutoff date for deletion
   * @returns {Promise<User[]>}
   */
  async findScheduledForDeletion(cutoffDate) {
    throw new Error('Method must be implemented by concrete user repository');
  }

  /**
   * Search users
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<{users: User[], total: number}>}
   */
  async search(query, options = {}) {
    throw new Error('Method must be implemented by concrete user repository');
  }
}

module.exports = UserRepository;