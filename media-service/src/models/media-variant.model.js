const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MediaVariant = sequelize.define(
    "MediaVariant",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      media_file_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "media_files",
          key: "id",
        },
      },
      variant_type: {
        type: DataTypes.ENUM(
          "thumbnail",
          "small",
          "medium",
          "large",
          "original",
          "mobile",
          "desktop",
          "360p",
          "480p",
          "720p",
          "1080p"
        ),
        allowNull: false,
        index: true,
      },
      format: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      width: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      height: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      file_size: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      quality: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: true,
        validate: {
          min: 1,
          max: 100,
        },
      },
      bitrate: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      duration: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
      },
      storage_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      cdn_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      processing_time: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Processing time in milliseconds",
      },
      is_optimized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "media_variants",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["media_file_id", "variant_type"],
          unique: true,
        },
        {
          fields: ["variant_type"],
        },
        {
          fields: ["format"],
        },
        {
          fields: ["width", "height"],
        },
      ],
    }
  );

  // Instance methods
  MediaVariant.prototype.getDisplaySize = function () {
    if (this.width && this.height) {
      return `${this.width}x${this.height}`;
    }
    return "unknown";
  };

  MediaVariant.prototype.getFileSize = function () {
    const size = this.file_size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024)
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  MediaVariant.prototype.toSafeObject = function () {
    const variant = this.toJSON();
    delete variant.storage_path;
    return variant;
  };

  // Class methods
  MediaVariant.findByMediaFile = async function (
    mediaFileId,
    variantType = null
  ) {
    const where = { media_file_id: mediaFileId };
    if (variantType) where.variant_type = variantType;

    return await this.findAll({
      where,
      order: [["variant_type", "ASC"]],
    });
  };

  MediaVariant.findOptimalVariant = async function (
    mediaFileId,
    maxWidth,
    maxHeight
  ) {
    return await this.findOne({
      where: {
        media_file_id: mediaFileId,
        width: { [sequelize.Sequelize.Op.lte]: maxWidth },
        height: { [sequelize.Sequelize.Op.lte]: maxHeight },
      },
      order: [
        ["width", "DESC"],
        ["height", "DESC"],
      ],
    });
  };

  return MediaVariant;
};
