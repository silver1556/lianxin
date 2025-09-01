'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const [users] = await queryInterface.sequelize.query(
            `SELECT id, phone FROM users WHERE phone IN ('+8613800000001', '+8613800000002', '+8613800000003');`
        );

        const now = new Date();
        const expiresInDays = 30;

        const sessionData = users.map((user, i) => ({
            user_id: user.id,
            session_id: uuidv4(),
            refresh_token: crypto.randomBytes(32).toString('hex'),
            device_info: JSON.stringify({
                os: i % 2 === 0 ? 'iOS' : 'Android',
                browser: i % 2 === 0 ? 'Safari' : 'Chrome',
                device_name: i % 2 === 0 ? 'iPhone 14' : 'Xiaomi Mi 11'
            }),
            ip_address: `192.168.0.${10 + i}`,
            user_agent: i % 2 === 0
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
                : 'Mozilla/5.0 (Linux; Android 13; Mi 11)',
            location: i % 2 === 0 ? 'Beijing, CN' : 'Shanghai, CN',
            is_active: true,
            expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
            created_at: now,
            revoked_at: null
        }));

        await queryInterface.bulkInsert('user_sessions', sessionData, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('user_sessions', null, {});
    }
};
