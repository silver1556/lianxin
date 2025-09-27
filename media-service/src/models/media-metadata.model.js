const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MediaMetadata = sequelize.define(
    "MediaMetadata",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      media_file_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: {
          model: "media_files",
          key: "id",
        },
      },
      original_width: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      original_height: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      duration: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        comment: "Duration in seconds for videos",
      },
      frame_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      bitrate: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      color_space: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      has_audio: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      audio_codec: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      video_codec: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      exif_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      camera_info: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      location_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ai_analysis: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "AI-powered content analysis results",
      },
      content_tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      dominant_colors: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      blur_hash: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "BlurHash for progressive loading",
      },
      is_live_photo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      live_photo_video_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: "media_metadata",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["media_file_id"],
          unique: true,
        },
        {
          fields: ["is_live_photo"],
        },
        {
          fields: ["original_width", "original_height"],
        },
      ],
    }
  );

  // Instance methods
  MediaMetadata.prototype.getAspectRatio = function () {
    if (this.original_width && this.original_height) {
      return (this.original_width / this.original_height).toFixed(2);
    }
    return null;
  };

  MediaMetadata.prototype.getResolution = function () {
    if (this.original_width && this.original_height) {
      return `${this.original_width}x${this.original_height}`;
    }
    return "unknown";
  };

  MediaMetadata.prototype.getDurationFormatted = function () {
    if (!this.duration) return null;

    const seconds = Math.floor(this.duration);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  MediaMetadata.prototype.hasLocation = function () {
    return this.location_data && Object.keys(this.location_data).length > 0;
  };

  MediaMetadata.prototype.hasCameraInfo = function () {
    return this.camera_info && Object.keys(this.camera_info).length > 0;
  };

  // Class methods
  MediaMetadata.findByMediaFile = async function (mediaFileId) {
    return await this.findOne({
      where: { media_file_id: mediaFileId },
    });
  };

  MediaMetadata.findLivePhotos = async function (userId = null) {
    const where = { is_live_photo: true };
    if (userId) where.user_id = userId;

    return await this.findAll({
      where,
      include: [
        {
          model: sequelize.models.MediaFile,
          as: "mediaFile",
          where: userId ? { user_id: userId } : {},
        },
      ],
    });
  };

  return MediaMetadata;
};
