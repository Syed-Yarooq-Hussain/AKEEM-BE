'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, DATE, DATEONLY, JSONB } = Sequelize;
    const id = { type: INTEGER, autoIncrement: true, primaryKey: true, allowNull: false };
    const fk = (table, allowNull = false) => ({ type: INTEGER, allowNull, references: { model: table, key: 'id' }, onUpdate: 'CASCADE', onDelete: allowNull ? 'SET NULL' : 'CASCADE' });
    const base = { id, created_at: { type: DATE, allowNull: false }, updated_at: { type: DATE, allowNull: false }, deleted_at: DATE };

    await queryInterface.createTable('refresh_tokens', {
      ...base, user_id: fk('users'), organization_id: fk('organizations'),
      token_hash: { type: STRING, allowNull: false, unique: true }, expires_at: { type: DATE, allowNull: false },
      revoked_at: DATE, user_agent: TEXT, ip_address: STRING,
    });
    await queryInterface.createTable('password_reset_tokens', {
      ...base, user_id: fk('users'), token_hash: { type: STRING, allowNull: false, unique: true },
      expires_at: { type: DATE, allowNull: false }, used_at: DATE,
    });
    await queryInterface.createTable('ai_tasks', {
      ...base, organization_id: fk('organizations'), project_id: fk('projects'), agent_id: fk('ai_agents', true),
      created_by_id: fk('users'), title: { type: STRING, allowNull: false }, description: TEXT,
      assistant: { type: STRING, allowNull: false }, status: { type: STRING, defaultValue: 'queued' },
      priority: { type: STRING, defaultValue: 'medium' }, progress: { type: INTEGER, defaultValue: 0 }, due_date: DATEONLY,
      input: { type: JSONB, defaultValue: {} }, output: { type: JSONB, defaultValue: {} }, error: TEXT,
      attempt_count: { type: INTEGER, defaultValue: 0 }, started_at: DATE, completed_at: DATE, cancelled_at: DATE,
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id', 'organization_id']);
    await queryInterface.addIndex('ai_tasks', ['organization_id', 'project_id']);
    await queryInterface.addIndex('ai_tasks', ['organization_id', 'status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ai_tasks');
    await queryInterface.dropTable('password_reset_tokens');
    await queryInterface.dropTable('refresh_tokens');
  },
};
