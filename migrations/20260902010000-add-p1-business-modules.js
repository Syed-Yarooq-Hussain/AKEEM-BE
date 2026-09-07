'use strict';
module.exports = {
  async up(q, S) {
    const { INTEGER, STRING, TEXT, DATE, DECIMAL, JSONB } = S;
    const id = { type: INTEGER, autoIncrement: true, primaryKey: true, allowNull: false };
    const fk = (model, nullable = false) => ({ type: INTEGER, allowNull: nullable, references: { model, key: 'id' }, onUpdate: 'CASCADE', onDelete: nullable ? 'SET NULL' : 'CASCADE' });
    const base = { id, created_at: { type: DATE, allowNull: false }, updated_at: { type: DATE, allowNull: false }, deleted_at: DATE };
    await q.addColumn('automations', 'project_id', fk('projects', true));
    await q.createTable('approvals', { ...base, organization_id: fk('organizations'), project_id: fk('projects', true), requested_by_user_id: fk('users', true), requested_by_agent_id: fk('ai_agents', true), reviewed_by_id: fk('users', true), title: { type: STRING, allowNull: false }, type: { type: STRING, allowNull: false }, amount: DECIMAL(16, 2), currency: { type: STRING, defaultValue: 'USD' }, status: { type: STRING, defaultValue: 'pending' }, description: TEXT, review_comment: TEXT, reviewed_at: DATE, metadata: { type: JSONB, defaultValue: {} } });
    await q.createTable('budgets', { ...base, organization_id: fk('organizations'), project_id: fk('projects', true), category_id: fk('transaction_categories', true), name: { type: STRING, allowNull: false }, amount: { type: DECIMAL(16, 2), allowNull: false }, currency: { type: STRING, defaultValue: 'USD' }, period_start: DATE, period_end: DATE, metadata: { type: JSONB, defaultValue: {} } });
    await q.createTable('reports', { ...base, organization_id: fk('organizations'), project_id: fk('projects', true), created_by_id: fk('users'), agent_id: fk('ai_agents', true), title: { type: STRING, allowNull: false }, assistant: { type: STRING, allowNull: false }, status: { type: STRING, defaultValue: 'generated' }, content: TEXT, format: STRING, storage_key: STRING, metadata: { type: JSONB, defaultValue: {} } });
    await q.createTable('organization_invitations', { ...base, organization_id: fk('organizations'), role_id: fk('roles'), invited_by_id: fk('users'), email: { type: STRING, allowNull: false }, token_hash: { type: STRING, allowNull: false, unique: true }, status: { type: STRING, defaultValue: 'pending' }, expires_at: { type: DATE, allowNull: false }, accepted_at: DATE });
    for (const table of ['approvals', 'budgets', 'reports', 'organization_invitations']) await q.addIndex(table, ['organization_id']);
    await q.addIndex('automations', ['organization_id', 'project_id']);
  },
  async down(q) {
    await q.dropTable('organization_invitations'); await q.dropTable('reports'); await q.dropTable('budgets'); await q.dropTable('approvals'); await q.removeColumn('automations', 'project_id');
  },
};
