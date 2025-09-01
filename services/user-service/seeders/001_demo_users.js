/**
 * Demo Users Seed Data
 * Creates sample users for development and testing
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const passwordHash = await bcrypt.hash('DemoPassword123!', 10);
    const now = new Date();

    const users = [
      {
        uuid: uuidv4(),
        phone: '+8613800000001',
        country_code: '+86',
        password_hash: passwordHash,
        password_changed_at: now,

        display_name: 'AliceZ',
        first_name: 'Alice',
        last_name: 'Zhang',
        bio: 'Love building cool stuff!',
        avatar_url: 'https://example.com/avatar1.png',
        cover_photo_url: 'https://example.com/cover1.jpg',
        birth_date: '1992-04-15',
        gender: 'female',
        location: 'Beijing, China',
        website: 'https://alice.dev',
        occupation: 'Frontend Engineer',
        education: 'Tsinghua University',
        relationship_status: 'single',
        languages: JSON.stringify(['zh-CN', 'en-US']),

        phone_verified: true,
        phone_verified_at: now,
        is_verified: true,
        verification_data: JSON.stringify({ id_type: 'passport', verified_by: 'admin' }),
        is_private: false,
        status: 'active',

        last_login: now,
        login_count: 5,
        registration_ip: '192.168.0.101',
        last_ip: '192.168.0.105',
        failed_login_attempts: 0,

        created_at: now,
        updated_at: now
      },
      {
        uuid: uuidv4(),
        phone: '+8613800000002',
        country_code: '+86',
        password_hash: passwordHash,
        password_changed_at: now,

        display_name: 'BobL',
        first_name: 'Bob',
        last_name: 'Li',
        bio: 'Tech enthusiast and traveler.',
        avatar_url: 'https://example.com/avatar2.png',
        cover_photo_url: 'https://example.com/cover2.jpg',
        birth_date: '1988-08-08',
        gender: 'male',
        location: 'Shenzhen, China',
        website: '',
        occupation: 'Product Manager',
        education: 'Peking University',
        relationship_status: 'married',
        languages: JSON.stringify(['zh-CN']),

        phone_verified: true,
        phone_verified_at: now,
        is_verified: false,
        verification_data: JSON.stringify({ id_type: 'id_card', submitted: true }),
        is_private: false,
        status: 'active',

        last_login: now,
        login_count: 12,
        registration_ip: '192.168.0.102',
        last_ip: '192.168.0.106',
        failed_login_attempts: 1,

        created_at: now,
        updated_at: now
      },
      {
        uuid: uuidv4(),
        phone: '+8613800000003',
        country_code: '+86',
        password_hash: passwordHash,
        password_changed_at: now,

        display_name: 'CharlieY',
        first_name: 'Charlie',
        last_name: 'Yu',
        bio: 'Always learning, always building.',
        avatar_url: 'https://example.com/avatar3.png',
        cover_photo_url: 'https://example.com/cover3.jpg',
        birth_date: '1995-12-25',
        gender: 'other',
        location: 'Hangzhou, China',
        website: 'https://charlie.codes',
        occupation: 'DevOps Engineer',
        education: 'Zhejiang University',
        relationship_status: 'complicated',
        languages: JSON.stringify(['zh-CN', 'en-GB']),

        phone_verified: false,
        phone_verified_at: null,
        is_verified: false,
        verification_data: JSON.stringify({ id_type: 'none' }),
        is_private: true,
        status: 'active',

        last_login: now,
        login_count: 0,
        registration_ip: '192.168.0.103',
        last_ip: '192.168.0.103',
        failed_login_attempts: 2,

        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('users', users, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', {
      phone: {
        [Sequelize.Op.in]: ['+8613800000001', '+8613800000002', '+8613800000003']
      }
    }, {});
  }
};
