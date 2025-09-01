CREATE TABLE IF NOT EXISTS user_profile( 
   id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
   user_id BIGINT UNSIGNED NOT NULL,
   display_name VARCHAR(20),
   first_name VARCHAR(10),
   last_name VARCHAR(10),
   bio TEXT,
   avatar_url VARCHAR(500),
   cover_photo_url VARCHAR(500),
   birth_date DATE NOT NULL,
   gender ENUM('male', 'female', 'other'),
   interested_in ENUM('men', 'women', 'both'),
   lives_in_location VARCHAR(100),
   hometown VARCHAR(100),
   occupation VARCHAR(100),
   salary INT,
   relationship_status ENUM('single', 'in_relationship', 'married', 'divorced'),
   languages JSON DEFAULT ('[]'),
   hobbies JSON DEFAULT ('[]'),
   skills JSON DEFAULT ('[]'),

   updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

   UNIQUE KEY uniq_user_profile_user (user_id),

   CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,

   -- Indexes
   INDEX idx_user_id (user_id)
)