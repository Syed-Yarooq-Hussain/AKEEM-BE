import { Column, DataType, ForeignKey, Table } from 'sequelize-typescript';
import { BaseModel } from './base.model';
import { Organization, User } from './core.models';

@Table({ tableName: 'files', underscored: true, paranoid: true })
export class FileAsset extends BaseModel<FileAsset> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare uploadedById: number;
  @Column({ allowNull: false }) declare originalName: string;
  @Column({ allowNull: false }) declare storageKey: string;
  @Column declare mimeType?: string;
  @Column({ type: DataType.BIGINT }) declare sizeBytes?: number;
  @Column declare entityType?: string;
  @Column(DataType.INTEGER) declare entityId?: number;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
  @Column declare detectedMimeType?: string;
  @Column declare checksumSha256?: string;
  @Column({ defaultValue: 'not_configured' }) declare scanStatus: string;
  @Column({ defaultValue: 'pending' }) declare processingStatus: string;
  @Column({ type: DataType.TEXT }) declare processingError?: string;
  @Column declare processedAt?: Date;
}
@Table({ tableName: 'notifications', underscored: true, paranoid: true })
export class Notification extends BaseModel<Notification> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @Column({ allowNull: false }) declare type: string;
  @Column({ allowNull: false }) declare title: string;
  @Column({ type: DataType.TEXT }) declare body?: string;
  @Column declare actionUrl?: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare data: object;
  @Column declare readAt?: Date;
}
@Table({
  tableName: 'audit_logs',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class AuditLog extends BaseModel<AuditLog> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare actorId?: number;
  @Column({ allowNull: false }) declare action: string;
  @Column({ allowNull: false }) declare entityType: string;
  @Column(DataType.INTEGER) declare entityId?: number;
  @Column({ type: DataType.JSONB }) declare before?: object;
  @Column({ type: DataType.JSONB }) declare after?: object;
  @Column declare ipAddress?: string;
  @Column declare userAgent?: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare metadata: object;
}
