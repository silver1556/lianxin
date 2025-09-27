/*
  # Create media metadata table

  1. New Tables
    - `media_metadata`
      - `id` (bigint, primary key, auto increment)
      - `media_file_id` (bigint, unique, foreign key to media_files)
      - `original_width` (int, nullable)
      - `original_height` (int, nullable)
      - `duration` (decimal, nullable)
      - `frame_rate` (decimal, nullable)
      - `bitrate` (int, nullable)
      - `color_space` (varchar, nullable)
      - `has_audio` (boolean, nullable)
      - `audio_codec` (varchar, nullable)
      - `video_codec` (varchar, nullable)
      - `exif_data` (json, nullable)
      - `camera_info` (json, nullable)
      - `location_data` (json, nullable)
      - `ai_analysis` (json, nullable)
      - `content_tags` (json, nullable)
      - `dominant_colors` (json, nullable)
      - `blur_hash` (varchar, nullable)
      - `is_live_photo` (boolean, default false)
      - `live_photo_video_path` (varchar, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Foreign key constraint to media_files table with CASCADE delete
    - Unique constraint on media_file_id
    - Indexes for performance optimization
*/

CREATE TABLE IF NOT EXISTS media_metadata (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    media_file_id BIGINT UNSIGNED NOT NULL UNIQUE,
    original_width INT UNSIGNED,
    original_height INT UNSIGNED,
    duration DECIMAL(10, 3) COMMENT 'Duration in seconds for videos',
    frame_rate DECIMAL(5, 2),
    bitrate INT UNSIGNED,
    color_space VARCHAR(20),
    has_audio BOOLEAN,
    audio_codec VARCHAR(50),
    video_codec VARCHAR(50),
    exif_data JSON,
    camera_info JSON,
    location_data JSON,
    ai_analysis JSON COMMENT 'AI-powered content analysis results',
    content_tags JSON DEFAULT ('[]'),
    dominant_colors JSON,
    blur_hash VARCHAR(100) COMMENT 'BlurHash for progressive loading',
    is_live_photo BOOLEAN DEFAULT FALSE,
    live_photo_video_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_media_file_id (media_file_id),
    INDEX idx_is_live_photo (is_live_photo),
    INDEX idx_dimensions (original_width, original_height),
    INDEX idx_duration (duration),
    INDEX idx_has_audio (has_audio)
);