
CREATE DATABASE IF NOT EXISTS user_service_db;
CREATE DATABASE IF NOT EXISTS place_service_db;
CREATE DATABASE IF NOT EXISTS media_service_db;

CREATE USER IF NOT EXISTS 'user_service'@'%' IDENTIFIED BY 'Mahmud1334';
CREATE USER IF NOT EXISTS 'place_service'@'%' IDENTIFIED BY 'Mahmud1334';
CREATE USER IF NOT EXISTS 'media_service'@'%' IDENTIFIED BY 'Mahmud1334';

GRANT ALL PRIVILEGES ON user_service_db.* TO 'user_service'@'%';
GRANT ALL PRIVILEGES ON place_service_db.* TO 'place_service'@'%';
GRANT ALL PRIVILEGES ON media_service_db.* TO 'media_service'@'%';

FLUSH PRIVILEGES;
