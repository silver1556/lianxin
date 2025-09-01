'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const [users] = await queryInterface.sequelize.query(
            `SELECT id FROM users WHERE phone IN ('+8613800000001', '+8613800000002', '+8613800000003');`
        );

        const now = new Date();

        const logs = [
            {
                user_id: users[0]?.id,
                action: 'login',
                resource: 'user_sessions',
                resource_id: 'session-1',
                old_values: null,
                new_values: { is_active: true },
                ip_address: '192.168.1.11',
                user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                session_id: 'session-1',
            },
            {
                user_id: users[1]?.id,
                action: 'update_profile',
                resource: 'users',
                resource_id: `${users[1]?.id}`,
                old_values: { display_name: 'Jane' },
                new_values: { display_name: 'Jane Updated' },
                ip_address: '192.168.1.12',
                user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                session_id: 'session-2',
            },
            {
                user_id: users[2]?.id,
                action: 'change_privacy',
                resource: 'user_settings',
                resource_id: `settings-${users[2]?.id}`,
                old_values: { profile_visibility: 'public' },
                new_values: { profile_visibility: 'friends' },
                ip_address: '192.168.1.13',
                user_agent: 'Mozilla/5.0 (Linux; Android 11)',
                session_id: 'session-3',
            }
        ].map(log => ({
            ...log,
            old_values: log.old_values ? JSON.stringify(log.old_values) : null,
            new_values: log.new_values ? JSON.stringify(log.new_values) : null,
            created_at: now
        }));

        await queryInterface.bulkInsert('audit_logs', logs, {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('audit_logs', null, {});
    }
};
