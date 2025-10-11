const { UserPrivacy, sequelize } = require("../models");

class PrivacyService {
  /**
   * Update user privacy settings
   * @param {string} userId - ID of the user
   * @param {Object} privacyFields - { field_name: privacy_value }. Example: { birth_date: 'private', email: 'public' }
   * NOTE: Just pass the fields that needs to update
   * @returns {Object} - updated privacy settings
   */
  async updateUserPrivacy(userId, privacyFields) {
    if (!privacyFields || Object.keys(privacyFields).length === 0) return {};

    // Fetch existing privacy settings
    const existing = await UserPrivacy.findAll({
      where: { user_id: userId },
      raw: true,
    });

    const existingMap = new Map(existing.map((p) => [p.field_name, p]));

    const toUpdate = [];
    const toInsert = [];

    for (const [field, value] of Object.entries(privacyFields)) {
      if (existingMap.has(field)) {
        if (existingMap.get(field).privacy !== value) {
          toUpdate.push({ field, value });
        }
      } else {
        toInsert.push({ user_id: userId, field_name: field, privacy: value });
      }
    }

    // Perform all inserts/updates in a transaction
    await sequelize.transaction(async (t) => {
      // Update existing
      for (const item of toUpdate) {
        await UserPrivacy.update(
          { privacy: item.value },
          {
            where: { user_id: userId, field_name: item.field },
            transaction: t,
          }
        );
      }

      // Insert new
      if (toInsert.length > 0) {
        await UserPrivacy.bulkCreate(toInsert, { transaction: t });
      }
    });

    // Return latest privacy settings
    const updated = await UserPrivacy.findAll({
      where: { user_id: userId },
      raw: true,
    });

    // Convert to single obeject { field_name: privacy } format
    return Object.fromEntries(updated.map((p) => [p.field_name, p.privacy]));
  }

  /**
   * Get all privacy settings for a user
   * @param {number|string} userId - ID of the user
   * @returns {Object} - { field_name: privacy_value }
   */
  async getUserPrivacy(userId) {
    const privacySettings = await UserPrivacy.findAll({
      where: { user_id: userId },
      raw: true,
    });

    // Convert to single obeject { field_name: privacy } format
    return Object.fromEntries(
      privacySettings.map((p) => [p.field_name, p.privacy])
    );
  }
}

module.exports = new PrivacyService();
