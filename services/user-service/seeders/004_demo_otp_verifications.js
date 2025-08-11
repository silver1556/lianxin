'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const [users] = await queryInterface.sequelize.query(
            `SELECT id, phone FROM users WHERE phone IN ('+8613800000001', '+8613800000002', '+8613800000003');`
        );

        const now = new Date();
        const expiresInMinutes = 10;

        const otpData = [
            {
                user: users[0],
                otp_code: '123456',
                otp_type: 'login'
            },
            {
                user: users[1],
                otp_code: '654321',
                otp_type: 'registration'
            },
            {
                user: users[2],
                otp_code: '112233',
                otp_type: 'password_reset'
            }
        ].map((entry, i) => ({
            verification_id: uuidv4(),
            user_id: entry.user.id,
            phone: entry.user.phone,
            country_code: '+86',
            otp_code: entry.otp_code,
            otp_type: entry.otp_type,
            is_verified: false,
            attempts: 0,
            max_attempts: 3,
            ip_address: `192.168.1.${i + 10}`,
            expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000),
            verified_at: null,
            created_at: now
        }));

        await queryInterface.bulkInsert('otp_verifications', otpData, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('otp_verifications', null, {});
    }
};
