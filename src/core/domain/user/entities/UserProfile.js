const DomainEvent = require('../../shared/events/DomainEvent');
const { v4: uuidv4 } = require('uuid');

/**
 * UserProfile Domain Entity
 * Represents user profile information with privacy controls
 */
class UserProfile {
  constructor({
    id = null,
    userId,
    displayName = null,
    firstName = null,
    lastName = null,
    bio = null,
    avatarUrl = null,
    coverPhotoUrl = null,
    birthDate = null,
    gender = null,
    hometown = null,
    livesIn = null,
    interestedIn = null,
    occupation = null,
    salary = null,
    relationshipStatus = null,
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
    this.interestedIn = interestedIn;
    this.occupation = occupation;
    this.salary = salary;
    this.relationshipStatus = relationshipStatus;
    this.languages = languages;
    this.hobbies = hobbies;
    this.skills = skills;
    this.privacySettings = privacySettings;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    // Domain events
    this.domainEvents = [];
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
    
    const event = new DomainEvent('UserProfileUpdated', this.userId, {
      changes
    });

    this.addDomainEvent(event);
    return event;
  }

  updateAvatar(avatarUrl) {
    const oldAvatarUrl = this.avatarUrl;
    this.avatarUrl = avatarUrl;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserAvatarUpdated', this.userId, {
      oldAvatarUrl,
      newAvatarUrl: avatarUrl
    });

    this.addDomainEvent(event);
    return event;
  }

  updateCoverPhoto(coverPhotoUrl) {
    const oldCoverPhotoUrl = this.coverPhotoUrl;
    this.coverPhotoUrl = coverPhotoUrl;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserCoverPhotoUpdated', this.userId, {
      oldCoverPhotoUrl,
      newCoverPhotoUrl: coverPhotoUrl
    });

    this.addDomainEvent(event);
    return event;
  }

  updatePrivacySettings(newSettings) {
    const oldSettings = { ...this.privacySettings };
    this.privacySettings = { ...this.privacySettings, ...newSettings };
    this.updatedAt = new Date();

    const event = new DomainEvent('UserPrivacySettingsUpdated', this.userId, {
      oldSettings,
      newSettings: this.privacySettings
    });

    this.addDomainEvent(event);
    return event;
  }

  updatePersonalInfo({
    birthDate,
    gender,
    hometown,
    livesIn,
    interestedIn,
    occupation,
    salary,
    relationshipStatus
  }) {
    const changes = {};

    if (birthDate !== undefined) {
      this.birthDate = birthDate;
      changes.birthDate = birthDate;
    }

    if (gender !== undefined) {
      this.gender = gender;
      changes.gender = gender;
    }

    if (hometown !== undefined) {
      this.hometown = hometown;
      changes.hometown = hometown;
    }

    if (livesIn !== undefined) {
      this.livesIn = livesIn;
      changes.livesIn = livesIn;
    }

    if (interestedIn !== undefined) {
      this.interestedIn = interestedIn;
      changes.interestedIn = interestedIn;
    }

    if (occupation !== undefined) {
      this.occupation = occupation;
      changes.occupation = occupation;
    }

    if (salary !== undefined) {
      this.salary = salary;
      changes.salary = salary;
    }

    if (relationshipStatus !== undefined) {
      this.relationshipStatus = relationshipStatus;
      changes.relationshipStatus = relationshipStatus;
    }

    this.updatedAt = new Date();

    const event = new DomainEvent('UserPersonalInfoUpdated', this.userId, {
      changes
    });

    this.addDomainEvent(event);
    return event;
  }

  updateInterests({ languages, hobbies, skills }) {
    const changes = {};

    if (languages !== undefined) {
      this.languages = languages;
      changes.languages = languages;
    }

    if (hobbies !== undefined) {
      this.hobbies = hobbies;
      changes.hobbies = hobbies;
    }

    if (skills !== undefined) {
      this.skills = skills;
      changes.skills = skills;
    }

    this.updatedAt = new Date();

    const event = new DomainEvent('UserInterestsUpdated', this.userId, {
      changes
    });

    this.addDomainEvent(event);
    return event;
  }

  // Domain Events Management
  addDomainEvent(event) {
    this.domainEvents.push(event);
  }

  getDomainEvents() {
    return [...this.domainEvents];
  }

  clearDomainEvents() {
    this.domainEvents = [];
  }

  // Factory Methods
  static create(profileData) {
    return new UserProfile(profileData);
  }

  static createDefault(userId) {
    const displayName = `user_${userId}`;
    const now = new Date();
    const birthDate18YearsAgo = new Date(
      now.getFullYear() - 18,
      now.getMonth(),
      now.getDate()
    );

    return new UserProfile({
      userId,
      displayName,
      bio: '',
      birthDate: birthDate18YearsAgo,
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
      interestedIn: data.interested_in,
      occupation: data.occupation,
      salary: data.salary,
      relationshipStatus: data.relationship_status,
      languages: data.languages || [],
      hobbies: data.hobbies || [],
      skills: data.skills || [],
      privacySettings: data.privacy_settings || {},
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
      interested_in: this.interestedIn,
      occupation: this.occupation,
      salary: this.salary,
      relationship_status: this.relationshipStatus,
      languages: this.languages,
      hobbies: this.hobbies,
      skills: this.skills,
      privacy_settings: this.privacySettings,
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
      bio: this.isFieldVisible('bio', viewerType) ? this.bio : null,
      createdAt: this.createdAt
    };

    if (this.isFieldVisible('occupation', viewerType)) {
      publicData.occupation = this.occupation;
    }

    if (this.isFieldVisible('hometown', viewerType)) {
      publicData.hometown = this.hometown;
    }

    if (this.isFieldVisible('languages', viewerType)) {
      publicData.languages = this.languages;
    }

    if (this.isFieldVisible('hobbies', viewerType)) {
      publicData.hobbies = this.hobbies;
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
      interestedIn: this.interestedIn,
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