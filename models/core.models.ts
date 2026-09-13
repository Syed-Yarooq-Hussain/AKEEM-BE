import {
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from './base.model';

@Table({ tableName: 'organizations', underscored: true, paranoid: true })
export class Organization extends BaseModel<Organization> {
  @Column({ allowNull: false }) declare name: string;
  @Column({ allowNull: false, unique: true }) declare slug: string;
  @Column declare logoUrl?: string;
  @Column({ defaultValue: 'UTC' }) declare timezone: string;
  @Column({ defaultValue: 'USD' }) declare currency: string;
  @Column({ defaultValue: 'en' }) declare locale: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare settings: object;
  @Column({ defaultValue: 'active' }) declare status: string;
  @HasMany(() => Membership) declare memberships: Membership[];
}

@Table({ tableName: 'users', underscored: true, paranoid: true })
export class User extends BaseModel<User> {
  @Column({ allowNull: false }) declare firstName: string;
  @Column({ allowNull: false }) declare lastName: string;
  @Column({ allowNull: false, unique: true }) declare email: string;
  @Column declare phone?: string;
  @Column declare avatarUrl?: string;
  @Column({ field: 'password_hash' }) declare passwordHash?: string;
  @Column declare lastLoginAt?: Date;
  @Column declare emailVerifiedAt?: Date;
  @Column({ defaultValue: 'active' }) declare status: string;
  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare preferences: object;
  @HasMany(() => Membership) declare memberships: Membership[];

  toJSON() {
    const value = super.toJSON() as unknown as Record<string, unknown>;
    delete value.passwordHash;
    return value;
  }
}

@Table({
  tableName: 'memberships',
  underscored: true,
  paranoid: true,
  indexes: [{ unique: true, fields: ['organization_id', 'user_id'] }],
})
export class Membership extends BaseModel<Membership> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @ForeignKey(() => Role) @Column(DataType.INTEGER) declare roleId: number;
  @Column({ defaultValue: 'active' }) declare status: string;
  @Column declare jobTitle?: string;
  @Column declare invitedAt?: Date;
  @Column declare joinedAt?: Date;
  @BelongsTo(() => Organization) declare organization: Organization;
  @BelongsTo(() => User) declare user: User;
  // `Role` is declared later in this file; avoid eager decorator metadata access.
  @BelongsTo(() => Role) declare role: any;
}

@Table({ tableName: 'roles', underscored: true, paranoid: true })
export class Role extends BaseModel<Role> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId?: number;
  @Column({ allowNull: false }) declare name: string;
  @Column declare description?: string;
  @Column({ defaultValue: false }) declare isSystem: boolean;
  @BelongsToMany(() => Permission, () => RolePermission)
  declare permissions: Permission[];
}

@Table({
  tableName: 'permissions',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class Permission extends BaseModel<Permission> {
  @Column({ allowNull: false, unique: true }) declare key: string;
  @Column({ allowNull: false }) declare module: string;
  @Column declare description?: string;
}

@Table({
  tableName: 'role_permissions',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class RolePermission extends BaseModel<RolePermission> {
  @ForeignKey(() => Role) @Column(DataType.INTEGER) declare roleId: number;
  @ForeignKey(() => Permission)
  @Column(DataType.INTEGER)
  declare permissionId: number;
}

@Table({ tableName: 'plans', underscored: true, paranoid: true })
export class Plan extends BaseModel<Plan> {
  @Column({ allowNull: false, unique: true }) declare code: string;
  @Column({ allowNull: false }) declare name: string;
  @Column({ type: DataType.DECIMAL(12, 2), defaultValue: 0 })
  declare monthlyPrice: number;
  @Column({ type: DataType.DECIMAL(12, 2), defaultValue: 0 })
  declare yearlyPrice: number;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare limits: object;
  @Column({ type: DataType.JSONB, defaultValue: [] })
  declare features: string[];
  @Column({ defaultValue: true }) declare isActive: boolean;
}

@Table({ tableName: 'subscriptions', underscored: true, paranoid: true })
export class Subscription extends BaseModel<Subscription> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Plan) @Column(DataType.INTEGER) declare planId: number;
  @Column({ defaultValue: 'trialing' }) declare status: string;
  @Column declare provider?: string;
  @Column declare providerCustomerId?: string;
  @Column declare providerSubscriptionId?: string;
  @Column declare trialEndsAt?: Date;
  @Column declare currentPeriodStart?: Date;
  @Column declare currentPeriodEnd?: Date;
  @Column declare cancelAt?: Date;
  @BelongsTo(() => Plan) declare plan: Plan;
}

@Table({ tableName: 'refresh_tokens', underscored: true, paranoid: true })
export class RefreshToken extends BaseModel<RefreshToken> {
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @Column({ allowNull: false, unique: true }) declare tokenHash: string;
  @Column({ allowNull: false }) declare expiresAt: Date;
  @Column declare revokedAt?: Date;
  @Column declare userAgent?: string;
  @Column declare ipAddress?: string;
}

@Table({
  tableName: 'password_reset_tokens',
  underscored: true,
  paranoid: true,
})
export class PasswordResetToken extends BaseModel<PasswordResetToken> {
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @Column({ allowNull: false, unique: true }) declare tokenHash: string;
  @Column({ allowNull: false }) declare expiresAt: Date;
  @Column declare usedAt?: Date;
}

@Table({
  tableName: 'organization_invitations',
  underscored: true,
  paranoid: true,
})
export class OrganizationInvitation extends BaseModel<OrganizationInvitation> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Role) @Column(DataType.INTEGER) declare roleId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare invitedById: number;
  @Column({ allowNull: false }) declare email: string;
  @Column({ allowNull: false, unique: true }) declare tokenHash: string;
  @Column({ defaultValue: 'pending' }) declare status: string;
  @Column({ allowNull: false }) declare expiresAt: Date;
  @Column declare acceptedAt?: Date;
  @Column declare revokedAt?: Date;
  @Column({ defaultValue: 0 }) declare resentCount: number;
  @Column declare lastSentAt?: Date;
}
