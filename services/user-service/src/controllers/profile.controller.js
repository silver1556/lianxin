//services\user-service\src\controllers\profile.controller.js

const { validationResult } = require("express-validator");

const profileService = require("../services/profile.service");
const educationService = require("../services/education.service");
const privacyService = require("../services/privacy.service");

const validationUtil = require("../utils/validation.util");
const logger = require("../../../../shared/utils/logger.util");
const apiResponse = require("../../../../shared/utils/api.response");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError");

/**
 * Get User Profile
 */
const getUserProfile = async (req, res, next) => {
  try {
    let userId = req.params.id;

    if (req.params.id === "me") {
      if (!req.user) {
        throw ValidationError.unauthorized(
          "Authentication required to access profile"
        );
      }
      userId = req.user.userId;
    }

    const profile = await profileService.getUserProfile(userId);

    const requestingUserId = req.user?.id;
    const isOwner = String(requestingUserId) === String(userId);

    //check viewer type
    let viewerType = "public";
    if (isOwner) {
      viewerType = "owner";
    }
    // TODO: handle friend logic in future
    /* NEED TO IMPLEMENT LATER
       else if (requestingUserId) {
        // NEED TO IMPLEMENT
        const areFriends = await profileService.checkFriendship(
          requestingUserId,
          userId
        );
        viewerType = areFriends ? "friend" : "public";
      } else {
        viewerType = "public";
      }
      */

    const response = profileService.buildProfileResponse(
      profile,
      isOwner,
      viewerType
    );

    logger.info("User profile retrieved", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { profile: response },
          "Profile retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Update User Profile with privacy settings (protected)
 * 
 * Request Body Example:
 * {
  "first_name": { "value": "John" },
  "last_name": { "value": "Doe" },
  "display_name": { "value": "Johnny" },
  "bio": { "value": "Software engineer with 10 years of experience." },
  "birth_date": { 
    "value": "1990-05-15T00:00:00.000Z",
    "privacy": { "birth_date": "friends", "birth_year": "public" }
  },
  "gender": { "value": "male" },
  "interested_in": { "value": "women" },
  "occupation": { "value": "Software Engineer", "privacy": "friends" },
  "salary": { "value": 120000, "privacy": "private" },
  "relationship_status": { "value": "single", "privacy": "friends" },
  "languages": { "value": ["en", "es"], "privacy": "public" },
  "hobbies": { "value": ["coding", "reading"], "privacy": "friends" },
  "skills": { "value": ["JavaScript", "Node.js"], "privacy": "friends" },
  "educations": {
    "value": [
      { "school_name": "Harvard", "degree": "B.Sc", "field_of_study": "CS", "start_year": 2008, "end_year": 2012 },
      { "school_name": "MIT", "degree": "M.Sc", "field_of_study": "AI", "start_year": 2013, "end_year": 2015 }
    ],
    "privacy": "friends"
  }
}

  * Response Example:
{
  "success": true,
  "message": "User profile updated successfully",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "profile": {
      "first_name": "John",
      "last_name": "Doe",
      "display_name": "Johnny",
      "bio": "Software engineer with 10 years of experience.",
      "birth_date": "1990-05-15T00:00:00.000Z",
      "gender": "male",
      "interested_in": "women",
      "occupation": "Software Engineer",
      "salary": 120000,
      "relationship_status": "single",
      "languages": ["en", "es"],
      "hobbies": ["coding", "reading"],
      "skills": ["JavaScript", "Node.js"]
    },
    "educations": [
      { "school_name": "Harvard", "degree": "B.Sc", "field_of_study": "CS", "start_year": 2008, "end_year": 2012 },
      { "school_name": "MIT", "degree": "M.Sc", "field_of_study": "AI", "start_year": 2013, "end_year": 2015 }
    ],
    "privacy": {
      "birth_date": "friends",
      "birth_year": "public",
      "occupation": "friends",
      "salary": "private",
      "relationship_status": "friends",
      "languages": "public",
      "hobbies": "friends",
      "skills": "friends",
      "educations": "friends"
    }
  }
}
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Split into profile, educations, privacy
    const profileFields = {};
    const educationFields = [];
    const privacyFields = {};

    for (const [field, obj] of Object.entries(req.body)) {
      if (!obj || typeof obj !== "object") continue;

      // Case 1: Educations (array of education objects)
      if (field === "educations" && Array.isArray(obj.value)) {
        educationFields.push(...obj.value);
        if (obj.privacy) {
          privacyFields[field] = obj.privacy;
        }
        continue;
      }

      // Case 2: Normal profile fields
      if (obj.value !== undefined) {
        profileFields[field] = obj.value;
      }

      // Case 3: Privacy rules
      if (obj.privacy !== undefined) {
        privacyFields[field] = obj.privacy;
      }
    }

    // Validate each section
    const validatedProfile = validationUtil.validateProfileUpdate(
      profileFields,
      "profileUpdateSchema"
    );
    const validatedEducations = validationUtil.validateProfileUpdate(
      educationFields,
      "educationFieldsSchema "
    );
    const validatedPrivacy = validationUtil.validateProfileUpdate(
      privacyFields,
      "privacyFieldsSchema"
    );

    // Run updates
    // 1. Update profile fields
    let updatedProfile;
    if (Object.keys(privacyFields).length > 0) {
      updatedProfile = await profileService.updateUserProfile(
        userId,
        validatedProfile
      );
    }

    // 2. Update educations
    let updatedEducations = [];
    if (educationFields.length > 0) {
      updatedEducations = await educationService.updateUserEducations(
        userId,
        validatedEducations
      );
    }

    // 3. Update privacy settings
    const updatedPrivacy = await privacyService.updateUserPrivacy(
      userId,
      validatedPrivacy
    );

    logger.info("User profile updated", {
      userId,
      updatedProfileFields: Object.keys(profileFields),
      updatedEducationCount: educationFields.length,
      updatedPrivacyFields: Object.keys(privacyFields),
      requestId: req.requestId,
    });

    res.status(200).json(
      apiResponse.success(
        {
          profile: updatedProfile,
          educations: updatedEducations,
          privacy: updatedPrivacy,
        },
        "User profile updated successfully",
        req.requestId
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Avatar URL (after uploading via Media Service)
 */
const updateAvatarUrl = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Avatar URL validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const userId = req.user.userId;
    const { avatar_url } = req.body;

    const updatedProfile = await profileService.updateUserProfile(userId, {
      avatar_url,
    });

    logger.info("User avatar URL updated", {
      userId,
      avatar_url,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          updatedProfile,
          "Avatar updated successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Cover Photo URL (after uploading via Media Service)
 */
const updateCoverUrl = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Cover photo URL validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const userId = req.user.userId;
    const { cover_photo_url } = req.body;

    const updatedProfile = await profileService.updateUserProfile(userId, {
      cover_photo_url,
    });

    logger.info("User cover photo URL updated", {
      userId,
      cover_photo_url,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          updatedProfile,
          "Cover photo updated successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateAvatarUrl,
  updateCoverUrl,
};
