/**
 * UserProfile Domain Entity
 * Represents user profile information
 */
class UserProfile {
  constructor({
    id,
    userId,
    displayName,
    firstName,
    lastName,
    bio,
    avatarUrl,
    coverPhotoUrl,
    birthDate,
    gender,
    hometown,
    livesIn,
    occupation,
    salary,
    relationshipStatus,
    languages = [],
    hobbies = [],
    skills = [],
    privacySettings = {},
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.displayName = displayName;
    this.firstName = firstName;
    this.lastName = lastName;
    this.bio = bio;
    this.avatarUrl = avatarUrl;
    this.coverPhotoUrl = coverPhotoUrl;
    this.birthDate = birthDate;
    this.gender = gender;
    this.hometown = hometown;
    this.livesIn = livesIn;
    this.occupation = occupation;
    this.salary = salary;
    this.relationshipStatus = relationshipStatus;
    this.languages = languages;
    this.hobbies = hobbies;
    this.skills = skills;
    this.privacySettings = privacySettings;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Business Rules
  canUpdateField(field, viewerType = 'public') {
    const privacy = this.privacySettings[field] || 'public';
    
    if (viewerType === 'owner') return true;
    if (privacy === 'private') return false;
    if (privacy === 'friends') return viewerType === 'friend';
    
    return true; // public
  }

  isFieldVisible(field, viewerType = 'public') {
    return this.canUpdateField(field, viewerType);
  }

  getAge() {
    if (!this.birthDate) return null;
    
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Domain Operations
  updateBasicInfo({ displayName, firstName, lastName, bio }) {
    const changes = {};
    
    if (displayName !== undefined) {
      this.displayName = displayName;
      changes.displayName = displayName;
    }
    
    if (firstName !== undefined) {
      this.firstName = firstName;
      changes.firstName = firstName;
    }
    
    if (lastName !== undefined) {
      this.lastName = lastName;
      changes.lastName = lastName;
    }
    
    if (bio !== undefined) {
      this.bio = bio;
      changes.bio = bio;
    }
    
    this.updatedAt = new Date();
    
    return {
      type: 'UserProfileUpdated',
      userId: this.userId,
      changes
    };
  }

  updateAvatar(avatarUrl) {
    const oldAvatarUrl = this.avatarUrl;
    this.avatarUrl = avatarUrl;
    this.updatedAt = new Date();

    return {
      type: 'UserAvatarUpdated',
      userId: this.userId,
      oldAvatarUrl,
      newAvatarUrl: avatarUrl
    };
  }

  updateCoverPhoto(coverPhotoUrl) {
    const oldCoverPhotoUrl = this.coverPhotoUrl;
    this.coverPhotoUrl = coverPhotoUrl;
    this.updatedAt = new Date();

    return {
      type: 'UserCoverPhotoUpdated',
      userId: this.userId,
      oldCoverPhotoUrl,
      newCoverPhotoUrl: coverPhotoUrl
    };
  }

  updatePrivacySettings(newSettings) {
    const oldSettings = { ...this.privacySettings };
    this.privacySettings = { ...this.privacySettings, ...newSettings };
    this.updatedAt = new Date();

    return {
      type: 'UserPrivacySettingsUpdated',
      userId: this.userId,
      oldSettings,
      newSettings: this.privacySettings
    };
  }

  // Factory Methods
  static create(profileData) {
    return new UserProfile(profileData);
  }

  static createDefault(userId) {
    return new UserProfile({
      userId,
      displayName: `user_${userId}`,
      bio: '',
      languages: [],
      hobbies: [],
      skills: [],
      privacySettings: {
        profile_visibility: 'public',
        birth_date: 'friends',
        occupation: 'public',
        salary: 'private'
      }
    });
  }

  static fromPersistence(data) {
    return new UserProfile({
      id: data.id,
      userId: data.user_id,
      displayName: data.display_name,
      firstName: data.first_name,
      lastName: data.last_name,
      bio: data.bio,
      avatarUrl: data.avatar_url,
      coverPhotoUrl: data.cover_photo_url,
      birthDate: data.birth_date,
      gender: data.gender,
      hometown: data.hometown,
      livesIn: data.lives_in,
      occupation: data.occupation,
      salary: data.salary,
      relationshipStatus: data.relationship_status,
      languages: data.languages || [],
      hobbies: data.hobbies || [],
      skills: data.skills || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });
  }

  toPersistence() {
    return {
      id: this.id,
      user_id: this.userId,
      display_name: this.displayName,
      first_name: this.firstName,
      last_name: this.lastName,
      bio: this.bio,
      avatar_url: this.avatarUrl,
      cover_photo_url: this.coverPhotoUrl,
      birth_date: this.birthDate,
      gender: this.gender,
      hometown: this.hometown,
      lives_in: this.livesIn,
      occupation: this.occupation,
      salary: this.salary,
      relationship_status: this.relationshipStatus,
      languages: this.languages,
      hobbies: this.hobbies,
      skills: this.skills,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  // View Models
  toPublicView(viewerType = 'public') {
    const publicData = {
      id: this.id,
      userId: this.userId,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      isVerified: this.isVerified
    };

    if (this.isFieldVisible('bio', viewerType)) {
      publicData.bio = this.bio;
    }

    if (this.isFieldVisible('occupation', viewerType)) {
      publicData.occupation = this.occupation;
    }

    if (this.isFieldVisible('hometown', viewerType)) {
      publicData.hometown = this.hometown;
    }

    return publicData;
  }

  toOwnerView() {
    return {
      id: this.id,
      userId: this.userId,
      displayName: this.displayName,
      firstName: this.firstName,
      lastName: this.lastName,
      bio: this.bio,
      avatarUrl: this.avatarUrl,
      coverPhotoUrl: this.coverPhotoUrl,
      birthDate: this.birthDate,
      gender: this.gender,
      hometown: this.hometown,
      livesIn: this.livesIn,
      occupation: this.occupation,
      salary: this.salary,
      relationshipStatus: this.relationshipStatus,
      languages: this.languages,
      hobbies: this.hobbies,
      skills: this.skills,
      privacySettings: this.privacySettings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = UserProfile;