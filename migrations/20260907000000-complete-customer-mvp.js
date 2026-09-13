'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DATE, INTEGER, JSONB, STRING, TEXT } = Sequelize;

    await queryInterface.addColumn('files', 'detected_mime_type', STRING);
    await queryInterface.addColumn('files', 'checksum_sha256', STRING);
    await queryInterface.addColumn('files', 'scan_status', {
      type: STRING,
      allowNull: false,
      defaultValue: 'not_configured',
    });
    await queryInterface.addColumn('files', 'processing_status', {
      type: STRING,
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.addColumn('files', 'processing_error', TEXT);
    await queryInterface.addColumn('files', 'processed_at', DATE);

    await queryInterface.addColumn('knowledge_documents', 'file_id', {
      type: INTEGER,
      references: { model: 'files', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('knowledge_documents', 'project_id', {
      type: INTEGER,
      references: { model: 'projects', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.createTable('knowledge_chunks', {
      id: {
        type: INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      organization_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      project_id: {
        type: INTEGER,
        references: { model: 'projects', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      file_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'files', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      knowledge_document_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'knowledge_documents', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      chunk_index: { type: INTEGER, allowNull: false },
      content: { type: TEXT, allowNull: false },
      reference: { type: STRING, allowNull: false },
      metadata: { type: JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
      deleted_at: DATE,
    });
    await queryInterface.addIndex('knowledge_chunks', [
      'organization_id',
      'project_id',
    ]);
    await queryInterface.addIndex('knowledge_chunks', ['file_id']);
    await queryInterface.addIndex('knowledge_documents', ['file_id'], {
      unique: true,
      name: 'knowledge_documents_file_unique',
    });
    await queryInterface.addIndex(
      'knowledge_chunks',
      ['knowledge_document_id', 'chunk_index'],
      { unique: true, name: 'knowledge_chunks_document_position_unique' },
    );
    await queryInterface.sequelize.query(
      "CREATE INDEX knowledge_chunks_content_fts ON knowledge_chunks USING GIN (to_tsvector('simple', content)) WHERE deleted_at IS NULL",
    );

    await queryInterface.addColumn(
      'organization_invitations',
      'revoked_at',
      DATE,
    );
    await queryInterface.addColumn('organization_invitations', 'resent_count', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn(
      'organization_invitations',
      'last_sent_at',
      DATE,
    );

    await queryInterface.addColumn('automations', 'retry_limit', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 3,
    });
    await queryInterface.addColumn('automations', 'timeout_seconds', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 60,
    });
    await queryInterface.addColumn('automation_runs', 'attempt_count', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('automation_runs', 'max_attempts', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 3,
    });
    await queryInterface.addColumn('automation_runs', 'available_at', DATE);
    await queryInterface.addColumn('automation_runs', 'locked_at', DATE);
    await queryInterface.addColumn(
      'automation_runs',
      'idempotency_key',
      STRING,
    );
    await queryInterface.addColumn('automation_runs', 'trigger_type', STRING);
    await queryInterface.addColumn('automation_runs', 'failure_reason', TEXT);
    await queryInterface.addColumn('automation_runs', 'action_results', {
      type: JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addIndex(
      'automation_runs',
      ['organization_id', 'idempotency_key'],
      { unique: true, name: 'automation_runs_idempotency_unique' },
    );
    await queryInterface.addIndex('automation_runs', [
      'status',
      'available_at',
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'automation_runs',
      'automation_runs_idempotency_unique',
    );
    await queryInterface.removeIndex('automation_runs', [
      'status',
      'available_at',
    ]);
    for (const column of [
      'action_results',
      'failure_reason',
      'trigger_type',
      'idempotency_key',
      'locked_at',
      'available_at',
      'max_attempts',
      'attempt_count',
    ]) {
      await queryInterface.removeColumn('automation_runs', column);
    }
    await queryInterface.removeColumn('automations', 'timeout_seconds');
    await queryInterface.removeColumn('automations', 'retry_limit');
    await queryInterface.removeColumn(
      'organization_invitations',
      'last_sent_at',
    );
    await queryInterface.removeColumn(
      'organization_invitations',
      'resent_count',
    );
    await queryInterface.removeColumn('organization_invitations', 'revoked_at');
    await queryInterface.dropTable('knowledge_chunks');
    await queryInterface.removeIndex(
      'knowledge_documents',
      'knowledge_documents_file_unique',
    );
    await queryInterface.removeColumn('knowledge_documents', 'project_id');
    await queryInterface.removeColumn('knowledge_documents', 'file_id');
    for (const column of [
      'processed_at',
      'processing_error',
      'processing_status',
      'scan_status',
      'checksum_sha256',
      'detected_mime_type',
    ]) {
      await queryInterface.removeColumn('files', column);
    }
  },
};
