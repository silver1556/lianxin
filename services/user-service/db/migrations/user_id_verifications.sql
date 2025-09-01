CREATE TABLE IF NOT EXISTS user_id_verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('id_card','passport') NOT NULL,
  document_url VARCHAR(500) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  expires_at DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_by_name VARCHAR(50) NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign key
  CONSTRAINT fk_id_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT fk_user_verifications_reviewer
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE,

  -- Indexes
  KEY idx_verification_status (status),
  KEY idx_verification_created_at (created_at)
);