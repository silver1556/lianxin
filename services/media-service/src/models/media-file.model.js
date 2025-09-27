const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize) => {
  const MediaFile = sequelize.define(
    "MediaFile",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      uuid: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        index: true,
      },
      original_filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      file_type: {
        type: DataTypes.ENUM("image", "video", "live_photo"),
        allowNull: false,
        index: true,
      },
      media_type: {
        type: DataTypes.ENUM("profile", "cover", "post", "story", "message"),
        allowNull: false,
        index: true,
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      file_size: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      file_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        index: true,
      },
      storage_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      cdn_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      processing_status: {
        type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
        allowNull: false,
        defaultValue: "pending",
        index: true,
      },
      malware_scan_status: {
        type: DataTypes.ENUM(
          "pending",
          "scanning",
          "clean",
          "infected",
          "failed"
        ),
        allowNull: false,
        defaultValue: "pending",
        index: true,
      },
      malware_scan_result: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        index: true,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        index: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        index: true,
      },
    },
    {
      tableName: "media_files",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      paranoid: false, // We handle soft deletes manually
      indexes: [
        {
          fields: ["user_id", "media_type"],
        },
        {
          fields: ["file_type", "processing_status"],
        },
        {
          fields: ["malware_scan_status"],
        },
        {
          fields: ["created_at"],
        },
        {
          fields: ["is_deleted", "deleted_at"],
        },
      ],
    }
  );

  // Instance methods
  MediaFile.prototype.isProcessed = function () {
    return this.processing_status === "completed";
  };

  MediaFile.prototype.isClean = function () {
    return this.malware_scan_status === "clean";
  };

  MediaFile.prototype.isReady = function () {
    return this.isProcessed() && this.isClean() && !this.is_deleted;
  };

  MediaFile.prototype.softDelete = async function () {
    this.is_deleted = true;
    this.deleted_at = new Date();
    return await this.save();
  };

  MediaFile.prototype.restore = async function () {
    this.is_deleted = false;
    this.deleted_at = null;
    return await this.save();
  };

  MediaFile.prototype.toSafeObject = function () {
    const file = this.toJSON();
    delete file.storage_path;
    delete file.malware_scan_result;
    return file;
  };

  // Class methods
  MediaFile.findByUuid = async function (uuid, includeDeleted = false) {
    const where = { uuid };
    if (!includeDeleted) {
      where.is_deleted = false;
    }
    return await this.findOne({ where });
  };

  MediaFile.findByUser = async function (userId, options = {}) {
    const {
      mediaType,
      fileType,
      limit = 50,
      offset = 0,
      includeDeleted = false,
    } = options;

    const where = { user_id: userId };
    if (mediaType) where.media_type = mediaType;
    if (fileType) where.file_type = fileType;
    if (!includeDeleted) where.is_deleted = false;

    return await this.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: sequelize.models.MediaVariant,
          as: "variants",
        },
        {
          model: sequelize.models.MediaMetadata,
          as: "metadata",
        },
      ],
    });
  };

  MediaFile.findByHash = async function (fileHash) {
    return await this.findOne({
      where: { file_hash: fileHash, is_deleted: false },
    });
  };

  MediaFile.cleanup = async function (daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        is_deleted: true,
        deleted_at: { [sequelize.Sequelize.Op.lt]: cutoffDate },
      },
    });
  };

  return MediaFile;
};
