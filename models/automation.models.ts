import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';
import { BaseModel } from './base.model'; import { Organization, User } from './core.models';

@Table({ tableName: 'ai_agents', underscored: true, paranoid: true })
export class AiAgent extends BaseModel<AiAgent> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @Column({ allowNull: false }) declare name: string; @Column declare description?: string; @Column declare avatarUrl?: string;
  @Column({ type: DataType.TEXT }) declare systemPrompt?: string; @Column declare model?: string;
  @Column({ type: DataType.DECIMAL(3, 2), defaultValue: 0.7 }) declare temperature: number;
  @Column({ type: DataType.JSONB, defaultValue: [] }) declare tools: object[]; @Column({ defaultValue: 'active' }) declare status: string;
}
@Table({ tableName: 'ai_conversations', underscored: true, paranoid: true })
export class AiConversation extends BaseModel<AiConversation> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare agentId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId?: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare initiatedByAgentId?: number;
  @Column declare title?: string; @Column({ defaultValue: 'active' }) declare status: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare context: object; @Column declare lastMessageAt?: Date;
}
@Table({ tableName: 'ai_messages', underscored: true, paranoid: true })
export class AiMessage extends BaseModel<AiMessage> {
  @ForeignKey(() => AiConversation) @Column(DataType.INTEGER) declare conversationId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare senderAgentId?: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare recipientAgentId?: number;
  @Column({ allowNull: false }) declare role: string; @Column({ type: DataType.TEXT, allowNull: false }) declare content: string;
  @Column declare model?: string; @Column({ defaultValue: 0 }) declare inputTokens: number; @Column({ defaultValue: 0 }) declare outputTokens: number;
  @Column({ type: DataType.JSONB, defaultValue: [] }) declare toolCalls: object[]; @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
@Table({ tableName: 'knowledge_documents', underscored: true, paranoid: true })
export class KnowledgeDocument extends BaseModel<KnowledgeDocument> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare agentId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare uploadedById: number;
  @Column({ allowNull: false }) declare title: string; @Column declare sourceType?: string; @Column declare sourceUrl?: string;
  @Column declare storageKey?: string; @Column declare mimeType?: string; @Column({ type: DataType.BIGINT }) declare sizeBytes?: number;
  @Column({ defaultValue: 'pending' }) declare processingStatus: string; @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
@Table({ tableName: 'automations', underscored: true, paranoid: true })
export class Automation extends BaseModel<Automation> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @Column(DataType.INTEGER) declare projectId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @Column({ allowNull: false }) declare name: string; @Column declare description?: string;
  @Column({ type: DataType.JSONB, allowNull: false }) declare trigger: object; @Column({ type: DataType.JSONB, defaultValue: [] }) declare actions: object[];
  @Column({ defaultValue: false }) declare isActive: boolean; @Column declare lastRunAt?: Date; @Column declare nextRunAt?: Date;
}
@Table({ tableName: 'automation_runs', underscored: true, paranoid: true })
export class AutomationRun extends BaseModel<AutomationRun> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => Automation) @Column(DataType.INTEGER) declare automationId: number;
  @Column({ defaultValue: 'queued' }) declare status: string; @Column({ type: DataType.JSONB, defaultValue: {} }) declare input: object;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare output: object; @Column({ type: DataType.TEXT }) declare error?: string;
  @Column declare startedAt?: Date; @Column declare finishedAt?: Date;
}
@Table({ tableName: 'integrations', underscored: true, paranoid: true })
export class Integration extends BaseModel<Integration> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @Column({ allowNull: false }) declare provider: string; @Column declare displayName?: string; @Column({ defaultValue: 'connected' }) declare status: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare credentialsEncrypted: object;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare settings: object; @Column declare lastSyncedAt?: Date;
}

@Table({ tableName: 'ai_agent_teams', underscored: true, paranoid: true })
export class AiAgentTeam extends BaseModel<AiAgentTeam> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ type: DataType.TEXT }) declare description?: string;
  @Column({ defaultValue: 'active' }) declare status: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare orchestrationConfig: object;
}

@Table({ tableName: 'ai_agent_team_members', underscored: true, timestamps: true, paranoid: false })
export class AiAgentTeamMember extends BaseModel<AiAgentTeamMember> {
  @ForeignKey(() => AiAgentTeam) @Column(DataType.INTEGER) declare teamId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare agentId: number;
  @Column({ defaultValue: 'worker' }) declare role: string;
  @Column({ defaultValue: 0 }) declare priority: number;
  @Column({ type: DataType.JSONB, defaultValue: [] }) declare capabilities: string[];
}

@Table({ tableName: 'ai_agent_delegations', underscored: true, paranoid: true })
export class AiAgentDelegation extends BaseModel<AiAgentDelegation> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => AiConversation) @Column(DataType.INTEGER) declare conversationId?: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare fromAgentId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare toAgentId: number;
  @ForeignKey(() => AiAgentDelegation) @Column(DataType.INTEGER) declare parentDelegationId?: number;
  @Column({ allowNull: false }) declare objective: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare input: object;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare output: object;
  @Column({ defaultValue: 'pending' }) declare status: string;
  @Column({ defaultValue: 0 }) declare attemptCount: number;
  @Column declare startedAt?: Date;
  @Column declare completedAt?: Date;
  @Column({ type: DataType.TEXT }) declare error?: string;
}

@Table({ tableName: 'ai_tasks', underscored: true, paranoid: true })
export class AiTask extends BaseModel<AiTask> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @Column(DataType.INTEGER) declare projectId: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare agentId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @Column({ allowNull: false }) declare title: string;
  @Column({ type: DataType.TEXT }) declare description?: string;
  @Column({ allowNull: false }) declare assistant: string;
  @Column({ defaultValue: 'queued' }) declare status: string;
  @Column({ defaultValue: 'medium' }) declare priority: string;
  @Column({ defaultValue: 0 }) declare progress: number;
  @Column declare dueDate?: Date;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare input: object;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare output: object;
  @Column({ type: DataType.TEXT }) declare error?: string;
  @Column({ defaultValue: 0 }) declare attemptCount: number;
  @Column declare startedAt?: Date;
  @Column declare completedAt?: Date;
  @Column declare cancelledAt?: Date;
}

@Table({ tableName: 'approvals', underscored: true, paranoid: true })
export class Approval extends BaseModel<Approval> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @Column(DataType.INTEGER) declare projectId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare requestedByUserId?: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare requestedByAgentId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare reviewedById?: number;
  @Column({ allowNull: false }) declare title: string;
  @Column({ allowNull: false }) declare type: string;
  @Column({ type: DataType.DECIMAL(16, 2) }) declare amount?: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column({ defaultValue: 'pending' }) declare status: string;
  @Column({ type: DataType.TEXT }) declare description?: string;
  @Column({ type: DataType.TEXT }) declare reviewComment?: string;
  @Column declare reviewedAt?: Date;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}

@Table({ tableName: 'reports', underscored: true, paranoid: true })
export class Report extends BaseModel<Report> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @Column(DataType.INTEGER) declare projectId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @ForeignKey(() => AiAgent) @Column(DataType.INTEGER) declare agentId?: number;
  @Column({ allowNull: false }) declare title: string;
  @Column({ allowNull: false }) declare assistant: string;
  @Column({ defaultValue: 'generated' }) declare status: string;
  @Column({ type: DataType.TEXT }) declare content?: string;
  @Column declare format?: string;
  @Column declare storageKey?: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
