const { UserEducations, sequelize } = require("../models");
const { Op } = require("sequelize");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError");

/**
 * Education Service
 * Handles user education field operations
 */
class EducationService {
  /**
   * Get all educations for a user
   * @param {number} userId - ID of the user
   * @return {Array} - Array of education objects
   */
  async getUserEducationsAll(userId) {
    return await UserEducations.findAll({
      where: { user_id: userId },
      order: [["start_year", "DESC"]],
      raw: true, // plain JSON objects
    });
  }

  // Get current/ongoing education for a user
  async findCurrentByUserId(userId) {
    return await UserEducations.findOne({
      where: { user_id: userId, is_current: true },
      order: [["start_year", "DESC"]],
    });
  }

  // Get education by start year (returns array of users)
  async findUsersByStartYear(startYear) {
    const users = await UserEducations.findAll({
      where: { start_year: startYear },
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // remove duplicates
      raw: true, // plain javascript objects
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  // Get education by end year (returns array of users)
  async findUsersByEndYear(endYear) {
    const users = await UserEducations.findAll({
      where: { end_year: endYear },
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // remove duplicates
      raw: true, // plain objects
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  // Get users by school name (returns array of users)
  async findUsersBySchool(schoolName) {
    const users = await UserEducations.findAll({
      where: { school_name: schoolName },
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // ensures each user appears only once even if multiple records exist
      order: [["start_year", "ASC"]],
      raw: true, //plain JavaScript objects
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  // Get users by degree (returns array of users)
  async findUsersByDegree(degree) {
    const users = await UserEducations.findAll({
      where: { degree: degree },
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // ensures each user appears only once even if multiple records exist
      order: [["start_year", "ASC"]],
      raw: true, //plain JavaScript objects
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  // Get users by field of study (returns array of users)
  async findUsersByFieldOfStudy(fieldOfStudy) {
    const users = await UserEducations.findAll({
      where: { field_of_study: fieldOfStudy },
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // ensures each user appears only once even if multiple records exist
      order: [["start_year", "ASC"]],
      raw: true, //plain JavaScript objects
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  // Get education by (school name, degree, field of study, start year, end year) dynamic search
  // (returns array of users)
  async dynamicSearchUsers({
    school_name,
    degree,
    field_of_study,
    start_year,
    end_year,
  }) {
    const where = {};

    if (school_name) where.school_name = { [Op.like]: `%${school_name}%` }; //Allows partial matching
    if (degree) where.degree = { [Op.like]: `%${degree}%` }; //Allows partial matching
    if (field_of_study)
      where.field_of_study = { [Op.like]: `%${field_of_study}%` }; //Allows partial matching
    if (start_year) where.start_year = start_year;
    if (end_year) where.end_year = end_year;

    const users = await UserEducations.findAll({
      where,
      attributes: ["user_id"], // only select user_id
      group: ["user_id"], // unique users
      order: [["start_year", "ASC"]],
      raw: true,
    });

    // Extract user IDs into an array
    return users.map((u) => u.user_id);
  }

  /**
   * Update user educations in bulk (add/update/delete)
   * Send what to keep or add in the update payload. Any existing field that is not included in the update payload is assumed deleted.
   * @param {number} userId - ID of the user
   * @param {Array} educations - Array of education objects
   */
  async updateUserEducations(userId, educations) {
    // Fetch existing educations from DB
    const existingEducations = await UserEducations.findAll({
      where: { user_id: userId },
      raw: true,
    });

    // Map existing by id for quick lookup
    const existingMap = new Map(existingEducations.map((e) => [e.id, e]));
    const seenIds = new Set();

    const toInsert = [];
    const toUpdate = [];

    for (const edu of educations) {
      if (edu.id && existingMap.has(edu.id)) {
        // Update existing
        toUpdate.push({
          id: edu.id,
          user_id: userId,
          school_name: edu.school_name,
          degree: edu.degree,
          field_of_study: edu.field_of_study,
          start_year: edu.start_year,
          end_year: edu.end_year,
          is_current: edu.is_current || false,
        });
        seenIds.add(edu.id);
      } else {
        // New entry
        toInsert.push({
          user_id: userId,
          school_name: edu.school_name,
          degree: edu.degree,
          field_of_study: edu.field_of_study,
          start_year: edu.start_year || null,
          end_year: edu.end_year || null,
          is_current: edu.is_current || false,
        });
      }
    }

    // IDs to delete (existing but not in the new list)
    const toDeleteIds = existingEducations
      .filter((e) => !seenIds.has(e.id))
      .map((e) => e.id);

    // Perform DB operations in a transaction
    return await sequelize.transaction(async (t) => {
      if (toInsert.length > 0) {
        await UserEducations.bulkCreate(toInsert, { transaction: t });
      }

      for (const edu of toUpdate) {
        await UserEducations.update(
          {
            school_name: edu.school_name,
            degree: edu.degree,
            field_of_study: edu.field_of_study,
            start_year: edu.start_year,
            end_year: edu.end_year,
          },
          {
            where: {
              id: edu.id, // use id to locate the row
              user_id: userId, // ensure user can only update their own record
            },
            transaction: t,
          }
        );
      }

      if (toDeleteIds.length > 0) {
        await UserEducations.destroy({
          where: { id: toDeleteIds },
          transaction: t,
        });
      }

      // Return an array of all current educations as plain JSON
      return await UserEducations.findAll({
        where: { user_id: userId },
        order: [["start_year", "DESC"]],
        raw: true, // plain objects ready for API response
        transaction: t,
      });
    });
  }
}

module.exports = new EducationService();
