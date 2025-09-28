const UserRepository = require('../../../core/domain/user/contracts/UserRepository');
const User = require('../../../core/domain/user/entities/User');
const UserProfile = require('../../../core/domain/user/entities/UserProfile');

/**
 * MySQL User Repository Adapter
 * Implements UserRepository contract using MySQL/Sequelize
 */
class UserMySQLAdapter extends UserRepository {
  constructor(sequelize, models, encryptionService) {
    super();
    this.sequelize = sequelize;
    this.UserModel = models.User;
    this.UserProfileModel = models.UserProfile;
    this.UserSettingModel = models.UserSetting;
    this.UserPrivacySettingModel = models.UserPrivacySetting;
    this.encryptionService = encryptionService;
  }

  async findById(id) {
    const userData = await this.UserModel.findByPk(id, {
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        },
        { 
          model: this.UserSettingModel, 
          as: 'setting',
          required: false
        },
        {
          model: this.UserPrivacySettingModel,
          as: 'privacySettings',
          required: false
        }
      ]
    });

    if (!userData) return null;

    return await this._toDomainEntity(userData);
  }

  async findByPhoneHash(phoneHash) {
    const userData = await this.UserModel.findOne({
      where: { phone_hash: phoneHash },
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        },
        { 
          model: this.UserSettingModel, 
          as: 'setting',
          required: false
        }
      ]
    });

    if (!userData) return null;

    return await this._toDomainEntity(userData);
  }

  async findByUuid(uuid) {
    const userData = await this.UserModel.findOne({
      where: { uuid },
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        }
      ]
    });

    if (!userData) return null;

    return await this._toDomainEntity(userData);
  }

  async findByStatus(status) {
    const usersData = await this.UserModel.findAll({
      where: { status },
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        }
      ]
    });

    const users = [];
    for (const userData of usersData) {
      users.push(await this._toDomainEntity(userData));
    }

    return users;
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
      users.push(await this._toDomainEntity(userData));
    }

    return users;
  }

  async search(query, options = {}) {
    const { limit = 20, offset = 0, type = 'name' } = options;

    let whereClause = {};

    switch (type) {
      case 'phone':
        // Note: This would need to search encrypted phone numbers
        whereClause.phone = { [this.sequelize.Op.like]: `%${query}%` };
        break;
      case 'id':
        whereClause.id = parseInt(query) || 0;
        break;
      case 'name':
      default:
        whereClause[this.sequelize.Op.or] = [
          { '$profile.display_name$': { [this.sequelize.Op.like]: `%${query}%` } },
          { '$profile.first_name$': { [this.sequelize.Op.like]: `%${query}%` } },
          { '$profile.last_name$': { [this.sequelize.Op.like]: `%${query}%` } }
        ];
        break;
    }

    const { count, rows } = await this.UserModel.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    const users = [];
    for (const userData of rows) {
      users.push(await this._toDomainEntity(userData));
    }

    return { users, total: count };
  }

  async save(user) {
    if (user.id) {
      return await this._update(user);
    } else {
      return await this._create(user);
    }
  }

  async delete(id) {
    const result = await this.UserModel.destroy({
      where: { id }
    });

    return result > 0;
  }

  async findWithFilters(filters, options = {}) {
    const { status, search } = filters;
    const { limit = 20, offset = 0 } = options;

    const whereClause = {};
    if (status) whereClause.status = status;

    if (search) {
      whereClause[this.sequelize.Op.or] = [
        { '$profile.display_name$': { [this.sequelize.Op.like]: `%${search}%` } },
        { '$profile.first_name$': { [this.sequelize.Op.like]: `%${search}%` } },
        { '$profile.last_name$': { [this.sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await this.UserModel.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: this.UserProfileModel, 
          as: 'profile',
          required: false
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    const users = [];
    for (const userData of rows) {
      users.push(await this._toDomainEntity(userData));
    }

    return { entities: users, total: count };
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

  // Private helper methods
  async _create(user) {
    const transaction = await this.sequelize.transaction();

    try {
      // Encrypt sensitive data
      const encryptedData = await this.encryptionService.encryptUserData(
        user.toPersistence()
      );

      // Create user record
      const createdUser = await this.UserModel.create(encryptedData, { transaction });

      // Create default profile
      const defaultProfile = UserProfile.createDefault(createdUser.id);
      const profileData = await this.encryptionService.encryptUserData(
        defaultProfile.toPersistence()
      );
      await this.UserProfileModel.create(profileData, { transaction });

      // Create default settings
      await this.UserSettingModel.create({
        user_id: createdUser.id
      }, { transaction });

      // Create default privacy settings
      await this.UserPrivacySettingModel.bulkCreate([
        { user_id: createdUser.id, field_name: 'birth_date', visibility: 'friends' },
        { user_id: createdUser.id, field_name: 'occupation', visibility: 'public' },
        { user_id: createdUser.id, field_name: 'salary', visibility: 'private' }
      ], { transaction });

      await transaction.commit();

      // Return updated user entity with ID
      user.id = createdUser.id;
      user.profile = defaultProfile;
      
      return user;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async _update(user) {
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
        const profileData = await this.encryptionService.encryptUserData(
          user.profile.toPersistence()
        );
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

  async _toDomainEntity(userData) {
    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptUserData(userData.toJSON());
    
    // Create user entity
    const user = User.fromPersistence(decryptedData);

    // Add profile if exists
    if (userData.profile) {
      const decryptedProfileData = await this.encryptionService.decryptUserData(
        userData.profile.toJSON()
      );
      user.profile = UserProfile.fromPersistence(decryptedProfileData);
    }

    return user;
  }
}

module.exports = UserMySQLAdapter;