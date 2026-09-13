import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from './base.model';
import { Organization, User } from './core.models';

@Table({ tableName: 'companies', underscored: true, paranoid: true })
export class Company extends BaseModel<Company> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @Column({ allowNull: false }) declare name: string;
  @Column declare domain?: string;
  @Column declare industry?: string;
  @Column declare phone?: string;
  @Column declare website?: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare address: object;
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare customFields: object;
  @Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
  declare tags: string[];
  @HasMany(() => Contact) declare contacts: Contact[];
}

@Table({ tableName: 'contacts', underscored: true, paranoid: true })
export class Contact extends BaseModel<Contact> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare ownerId?: number;
  @Column({ allowNull: false }) declare firstName: string;
  @Column declare lastName?: string;
  @Column declare email?: string;
  @Column declare phone?: string;
  @Column declare jobTitle?: string;
  @Column({ defaultValue: 'lead' }) declare lifecycleStage: string;
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare customFields: object;
  @Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
  declare tags: string[];
  @BelongsTo(() => Company) declare company?: Company;
}

@Table({ tableName: 'pipelines', underscored: true, paranoid: true })
export class Pipeline extends BaseModel<Pipeline> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ defaultValue: true }) declare isDefault: boolean;
  @HasMany(() => PipelineStage) declare stages: PipelineStage[];
}

@Table({ tableName: 'pipeline_stages', underscored: true, paranoid: true })
export class PipelineStage extends BaseModel<PipelineStage> {
  @ForeignKey(() => Pipeline)
  @Column(DataType.INTEGER)
  declare pipelineId: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ defaultValue: 0 }) declare position: number;
  @Column({ defaultValue: 0 }) declare probability: number;
  @Column declare color?: string;
}

@Table({ tableName: 'deals', underscored: true, paranoid: true })
export class Deal extends BaseModel<Deal> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Pipeline)
  @Column(DataType.INTEGER)
  declare pipelineId: number;
  @ForeignKey(() => PipelineStage)
  @Column(DataType.INTEGER)
  declare stageId: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => Contact)
  @Column(DataType.INTEGER)
  declare contactId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare ownerId?: number;
  @Column({ allowNull: false }) declare title: string;
  @Column({ type: DataType.DECIMAL(14, 2), defaultValue: 0 })
  declare value: number;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column declare expectedCloseDate?: Date;
  @Column({ defaultValue: 'open' }) declare status: string;
  @Column declare lostReason?: string;
}

@Table({ tableName: 'crm_activities', underscored: true, paranoid: true })
export class CrmActivity extends BaseModel<CrmActivity> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Contact)
  @Column(DataType.INTEGER)
  declare contactId?: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => Deal) @Column(DataType.INTEGER) declare dealId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @Column({ allowNull: false }) declare type: string;
  @Column declare subject?: string;
  @Column({ type: DataType.TEXT }) declare body?: string;
  @Column declare occurredAt: Date;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
