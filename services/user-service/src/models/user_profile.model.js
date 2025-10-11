module.exports = (sequelize, DataTypes) => {
  const UserProfile = sequelize.define(
    "UserProfile",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      display_name: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
          len: [1, 20],
        },
      },
      first_name: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
          len: [1, 10],
        },
      },
      last_name: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
          len: [1, 10],
        },
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 500],
        },
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      cover_photo_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      birth_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: (() => {
          const today = new Date();
          today.setFullYear(today.getFullYear() - 18);
          return today.toISOString().split("T")[0];
        })(),
        validate: {
          isDate: true,
          isBefore: new Date().toISOString().split("T")[0],
        },
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: true,
      },
      hometown: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      lives_in: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      interested_in: {
        type: DataTypes.ENUM("men", "women", "both"),
        allowNull: true,
      },
      occupation: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      salary: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      relationship_status: {
        type: DataTypes.ENUM(
          "single",
          "in_relationship",
          "married",
          "Divorced"
        ),
        allowNull: true,
      },
      languages: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      hobbies: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      skills: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      tableName: "user_profiles",
      timestamps: true, // enables created_at & updated_at
      createdAt: false,
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true, // one profile per user
          fields: ["user_id"],
        },
      ],
    }
  );

  // Associations
  UserProfile.associate = (models) => {
    UserProfile.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  UserProfile.createDefault = async function (userId, options = {}) {
    const displayName = `user_${userId}`;
    const now = new Date();
    const birthDate18YearsAgo = new Date(
      now.getFullYear() - 18,
      now.getMonth(),
      now.getDate()
    );

    // Create avatar URL based on first letter of display name
    const firstLetter = displayName.charAt(0).toUpperCase();
    const avatarUrl = `https://ui-avatars.com/api/?name=${firstLetter}&background=random`;

    const defaultProfile = {
      user_id: userId,
      display_name: displayName, // fallback username
      bio: "",
      avatar_url: avatarUrl,
      cover_photo_url: null,
      birth_date: birthDate18YearsAgo,
      gender: null,
      hometown: null,
      lives_in: null,
      interested_in: null,
      occupation: null,
      salary: null,
      relationship_status: null,
      languages: [],
      hobbies: [],
      skills: [],
    };

    return (await this.create(defaultProfile, options)).toJSON(); // plain JavaScript object is returned instead of a Sequelize instance.
  };

  return UserProfile;
};
