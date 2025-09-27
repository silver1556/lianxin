const UserRepositoryPort = require('../../../../core/domain/user/ports/UserRepositoryPort');
const User = require('../../../../core/domain/user/entities/User');

/**
 * MySQL User Repository Adapter
 * Implements UserRepositoryPort using MySQL/Sequelize
 */
class UserMySQLAdapter extends UserRepositoryPort {
  constructor(sequelize, models, encryptionService) {
    super();
    this.sequelize = sequelize;
    this.UserModel = models.User;
    this.UserProfileModel = models.UserProfile;
    this.UserSettingModel = models.UserSetting;
    this.encryptionService = encryptionService;
  }

  async findById(id) {
    const userData = await this.UserModel.findByPk(id, {
      include: [
        { model: this.UserProfileModel, as: 'profile' },
        { model: this.UserSettingModel, as: 'setting' }
      ]
    });

    if (!userData) return null;

    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
    
    return User.fromPersistence(decryptedData);
  }

  async findByPhoneHash(phoneHash) {
    const userData = await this.UserModel.findOne({
      where: { phone_hash: phoneHash },
      include: [
        { model: this.UserProfileModel, as: 'profile' },
        { model: this.UserSettingModel, as: 'setting' }
      ]
    });

    if (!userData) return null;

    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
    
    return User.fromPersistence(decryptedData);
  }

  async findByUuid(uuid) {
    const userData = await this.UserModel.findOne({
      where: { uuid },
      include: [
        { model: this.UserProfileModel, as: 'profile' },
        { model: this.UserSettingModel, as: 'setting' }
      ]
    });

    if (!userData) return null;

    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
    
    return User.fromPersistence(decryptedData);
  }

  async save(user) {
    if (user.id) {
      return await this.update(user);
    } else {
      return await this.create(user);
    }
  }

  async create(user) {
    const transaction = await this.sequelize.transaction();

    try {
      // Encrypt sensitive data
      const encryptedData = await this.encryptionService.encryptUserData(
        user.toPersistence()
      );

      // Create user record
      const createdUser = await this.UserModel.create(encryptedData, { transaction });

      // Create default profile if provided
      if (user.profile) {
        const profileData = user.profile.toPersistence();
        profileData.user_id = createdUser.id;
        await this.UserProfileModel.create(profileData, { transaction });
      }

      // Create default settings if provided
      if (user.settings) {
        const settingsData = { user_id: createdUser.id, ...user.settings };
        await this.UserSettingModel.create(settingsData, { transaction });
      }

      await transaction.commit();

      // Return updated user entity with ID
      user.id = createdUser.id;
      return user;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(user) {
    const transaction = await this.sequelize.transaction();

    try {
      // Encrypt sensitive data
      const encryptedData = await this.encryptionService.encryptUserData(
        user.toPersistence()
      );

      // Update user record
      await this.UserModel.update(encryptedData, {
        where: { id: user.id },
        transaction
      });

      // Update profile if exists
      if (user.profile) {
        const profileData = user.profile.toPersistence();
        await this.UserProfileModel.update(profileData, {
          where: { user_id: user.id },
          transaction
        });
      }

      await transaction.commit();
      return user;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async delete(id) {
    const result = await this.UserModel.destroy({
      where: { id }
    });

    return result > 0;
  }

  async findWithFilters(filters, pagination) {
    const { status, search } = filters;
    const { limit, offset } = pagination;

    const whereClause = {};
    if (status) whereClause.status = status;

    if (search) {
      whereClause[this.sequelize.Op.or] = [
        { display_name: { [this.sequelize.Op.like]: `%${search}%` } },
        { first_name: { [this.sequelize.Op.like]: `%${search}%` } },
        { last_name: { [this.sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await this.UserModel.findAndCountAll({
      where: whereClause,
      include: [
        { model: this.UserProfileModel, as: 'profile' }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    // Decrypt and convert to domain entities
    const users = [];
    for (const userData of rows) {
      const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
      users.push(User.fromPersistence(decryptedData));
    }

    return { users, total: count };
  }

  async countByStatus(status) {
    return await this.UserModel.count({
      where: { status }
    });
  }

  async findScheduledForDeletion(cutoffDate) {
    const usersData = await this.UserModel.findAll({
      where: {
        status: 'pending_deletion',
        pending_deletion_at: {
          [this.sequelize.Op.lt]: cutoffDate
        }
      }
    });

    const users = [];
    for (const userData of usersData) {
      const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
      users.push(User.fromPersistence(decryptedData));
    }

    return users;
  }

  async beginTransaction() {
    return await this.sequelize.transaction();
  }

  async commitTransaction(transaction) {
    return await transaction.commit();
  }

  async rollbackTransaction(transaction) {
    return await transaction.rollback();
  }
}

module.exports = UserMySQLAdapter;