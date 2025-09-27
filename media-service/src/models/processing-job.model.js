const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize) => {
  const ProcessingJob = sequelize.define(
    "ProcessingJob",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      job_id: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      media_file_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "media_files",
          key: "id",
        },
      },
      job_type: {
        type: DataTypes.ENUM(
          "image_processing",
          "video_processing",
          "malware_scan",
          "thumbnail_generation",
          "format_conversion",
          "live_photo_processing"
        ),
        allowNull: false,
        index: true,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "processing",
          "completed",
          "failed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
        index: true,
      },
      priority: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 5,
        validate: {
          min: 1,
          max: 10,
        },
      },
      progress: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100,
        },
      },
      processing_options: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      result_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      processing_time: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Processing time in milliseconds",
      },
      worker_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      retry_count: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      max_retries: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 3,
      },
    },
    {
      tableName: "processing_jobs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["media_file_id"],
        },
        {
          fields: ["job_type", "status"],
        },
        {
          fields: ["status", "priority"],
        },
        {
          fields: ["created_at"],
        },
        {
          fields: ["worker_id"],
        },
      ],
    }
  );

  // Instance methods
  ProcessingJob.prototype.start = async function (workerId = null) {
    this.status = "processing";
    this.started_at = new Date();
    this.worker_id = workerId;
    return await this.save();
  };

  ProcessingJob.prototype.complete = async function (resultData = null) {
    this.status = "completed";
    this.completed_at = new Date();
    this.progress = 100;
    this.result_data = resultData;

    if (this.started_at) {
      this.processing_time = new Date() - this.started_at;
    }

    return await this.save();
  };

  ProcessingJob.prototype.fail = async function (errorMessage) {
    this.status = "failed";
    this.completed_at = new Date();
    this.error_message = errorMessage;

    if (this.started_at) {
      this.processing_time = new Date() - this.started_at;
    }

    return await this.save();
  };

  ProcessingJob.prototype.updateProgress = async function (progress) {
    this.progress = Math.min(100, Math.max(0, progress));
    return await this.save();
  };

  ProcessingJob.prototype.retry = async function () {
    if (this.retry_count >= this.max_retries) {
      throw new Error("Maximum retry attempts exceeded");
    }

    this.retry_count += 1;
    this.status = "pending";
    this.error_message = null;
    this.started_at = null;
    this.completed_at = null;
    this.progress = 0;

    return await this.save();
  };

  ProcessingJob.prototype.cancel = async function () {
    this.status = "cancelled";
    this.completed_at = new Date();
    return await this.save();
  };

  ProcessingJob.prototype.getDuration = function () {
    if (this.started_at && this.completed_at) {
      return this.completed_at - this.started_at;
    }
    return null;
  };

  // Class methods
  ProcessingJob.findPending = async function (jobType = null, limit = 10) {
    const where = { status: "pending" };
    if (jobType) where.job_type = jobType;

    return await this.findAll({
      where,
      order: [
        ["priority", "DESC"],
        ["created_at", "ASC"],
      ],
      limit,
    });
  };

  ProcessingJob.findByMediaFile = async function (mediaFileId) {
    return await this.findAll({
      where: { media_file_id: mediaFileId },
      order: [["created_at", "DESC"]],
    });
  };

  ProcessingJob.cleanup = async function (daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ["completed", "failed", "cancelled"],
        },
        completed_at: { [sequelize.Sequelize.Op.lt]: cutoffDate },
      },
    });
  };

  ProcessingJob.getStats = async function (timeframe = "24h") {
    const timeframes = {
      "1h": 1,
      "24h": 24,
      "7d": 24 * 7,
      "30d": 24 * 30,
    };

    const hours = timeframes[timeframe] || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stats = await this.findAll({
      where: {
        created_at: { [sequelize.Sequelize.Op.gte]: since },
      },
      attributes: [
        "status",
        "job_type",
        [sequelize.fn("COUNT", "*"), "count"],
        [
          sequelize.fn("AVG", sequelize.col("processing_time")),
          "avg_processing_time",
        ],
      ],
      group: ["status", "job_type"],
      raw: true,
    });

    return stats;
  };

  return ProcessingJob;
};
