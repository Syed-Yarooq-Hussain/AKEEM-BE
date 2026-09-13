import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AcceptInvitationDto } from './dto/invitation.dto';
import {
  Membership,
  Organization,
  OrganizationInvitation,
  Role,
  User,
} from '../../models';
import { safeUser } from '../common/safe-user';
import { EmailService } from '../email/email.service';

type AuthUser = { id: number; organizationId: number; role?: string };

const STANDARD_ROLES = [
  { name: 'Owner', description: 'Full organization access' },
  { name: 'Admin', description: 'Manage organization settings and members' },
  { name: 'Member', description: 'Standard workspace access' },
];

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Organization) private readonly orgs: typeof Organization,
    @InjectModel(Membership)
    private readonly memberships: typeof Membership,
    @InjectModel(OrganizationInvitation)
    private readonly invitations: typeof OrganizationInvitation,
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(User) private readonly users: typeof User,
    private readonly email: EmailService,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async organization(auth: AuthUser) {
    const organization = await this.orgs.findByPk(auth.organizationId);
    if (!organization) throw new NotFoundException('Organization not found');
    return {
      ...organization.toJSON(),
      language: organization.locale,
      plan: 'default',
    };
  }

  async updateOrganization(auth: AuthUser, body: any) {
    this.owner(auth);
    const organization = await this.orgs.findByPk(auth.organizationId);
    if (!organization) throw new NotFoundException('Organization not found');
    return organization.update({
      name: body.name,
      logoUrl: body.logoUrl,
      timezone: body.timezone,
      currency: body.currency,
      locale: body.language || body.locale,
      settings: body.settings,
    });
  }

  async members(auth: AuthUser) {
    const rows = await this.memberships.findAll({
      where: { organizationId: auth.organizationId },
      include: [
        { model: User, attributes: { exclude: ['passwordHash'] } },
        Role,
      ],
      order: [['createdAt', 'ASC']],
    });
    return rows.map((membership) => this.presentMembership(membership));
  }

  async roleDirectory(auth: AuthUser) {
    this.owner(auth);
    await this.ensureStandardRoles(auth.organizationId);
    const roles = await this.roles.findAll({
      where: { organizationId: auth.organizationId },
      order: [['name', 'ASC']],
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description || null,
      isSystem: role.isSystem,
    }));
  }

  async invite(auth: AuthUser, body: any) {
    this.owner(auth);
    if (!body.email) throw new BadRequestException('email is required');
    await this.ensureStandardRoles(auth.organizationId);
    const role = body.roleId
      ? await this.roles.findOne({
          where: { id: body.roleId, organizationId: auth.organizationId },
        })
      : await this.roles.findOne({
          where: {
            organizationId: auth.organizationId,
            name: { [Op.iLike]: String(body.role || 'Member') },
          },
        });
    if (!role) throw new NotFoundException('Role not found');
    const token = randomBytes(32).toString('hex');
    const invitation = await this.invitations.create({
      organizationId: auth.organizationId,
      roleId: role.id,
      invitedById: auth.id,
      email: String(body.email).trim().toLowerCase(),
      tokenHash: createHash('sha256').update(token).digest('hex'),
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 86400000),
      lastSentAt: new Date(),
    });
    const value = invitation.toJSON() as Record<string, any>;
    delete value.tokenHash;
    const invitationUrl = `${process.env.FRONTEND_APP_URL || 'http://localhost:5173'}/accept-invitation?token=${encodeURIComponent(token)}`;
    const organization = await this.orgs.findByPk(auth.organizationId);
    const delivered = await this.email.sendInvitation(
      invitation.email,
      invitationUrl,
      organization?.name || 'AKEEM',
    );
    return {
      ...value,
      emailDelivered: delivered,
      ...(process.env.NODE_ENV !== 'production'
        ? { invitationToken: token, invitationUrl }
        : {}),
    };
  }

  async inspectInvitation(token: string) {
    const invitation = await this.validInvitation(token);
    const [organization, role, existingUser] = await Promise.all([
      this.orgs.findByPk(invitation.organizationId, {
        attributes: ['id', 'name', 'logoUrl'],
      }),
      this.roles.findOne({
        where: {
          id: invitation.roleId,
          organizationId: invitation.organizationId,
        },
        attributes: ['id', 'name'],
      }),
      this.users.findOne({
        where: { email: invitation.email },
        attributes: ['id'],
      }),
    ]);
    if (!organization || !role) throw this.invalidInvitation();
    return {
      valid: true,
      email: invitation.email,
      existingUser: Boolean(existingUser),
      expiresAt: invitation.expiresAt,
      organization,
      role,
    };
  }

  async acceptInvitation(
    body: AcceptInvitationDto,
    authenticatedUserId?: number,
  ) {
    const tokenHash = this.invitationDigest(body.token);
    return this.sequelize.transaction(async (transaction) => {
      const invitation = await this.invitations.findOne({
        where: { tokenHash },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      this.assertInvitationUsable(invitation);
      if (
        body.email &&
        body.email.trim().toLowerCase() !== invitation.email.toLowerCase()
      ) {
        throw this.invalidInvitation();
      }
      const [organization, role] = await Promise.all([
        this.orgs.findByPk(invitation.organizationId, { transaction }),
        this.roles.findOne({
          where: {
            id: invitation.roleId,
            organizationId: invitation.organizationId,
          },
          transaction,
        }),
      ]);
      if (!organization || !role) throw this.invalidInvitation();

      let user = await this.users.findOne({
        where: { email: invitation.email.toLowerCase() },
        transaction,
      });
      if (user) {
        if (authenticatedUserId && authenticatedUserId !== user.id) {
          throw new ForbiddenException('Invitation belongs to another user');
        }
        if (
          !authenticatedUserId &&
          (!body.password ||
            !(await compare(body.password, user.passwordHash || '')))
        ) {
          throw new UnauthorizedException({
            message: 'Sign in or provide the existing account password',
            code: 'INVITATION_AUTH_REQUIRED',
          });
        }
      } else {
        if (
          !body.firstName?.trim() ||
          !body.lastName?.trim() ||
          !body.password
        ) {
          throw new BadRequestException({
            message:
              'firstName, lastName and a password of at least 8 characters are required',
            code: 'INVITATION_PROFILE_REQUIRED',
          });
        }
        user = await this.users.create(
          {
            firstName: body.firstName.trim(),
            lastName: body.lastName.trim(),
            email: invitation.email.toLowerCase(),
            passwordHash: await hash(body.password, 12),
            emailVerifiedAt: new Date(),
            status: 'active',
            preferences: {},
          },
          { transaction },
        );
      }
      if (user.status !== 'active') {
        throw new ForbiddenException('User account is not active');
      }
      const [membership] = await this.memberships.findOrCreate({
        where: {
          organizationId: invitation.organizationId,
          userId: user.id,
        },
        defaults: {
          organizationId: invitation.organizationId,
          userId: user.id,
          roleId: invitation.roleId,
          status: 'active',
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
        },
        transaction,
      });
      if (
        membership.roleId !== invitation.roleId ||
        membership.status !== 'active'
      ) {
        await membership.update(
          { roleId: invitation.roleId, status: 'active', joinedAt: new Date() },
          { transaction },
        );
      }
      await invitation.update(
        { status: 'accepted', acceptedAt: new Date() },
        { transaction },
      );
      return {
        accepted: true,
        redirectTo: '/login?invitation=accepted',
        organization: { id: organization.id, name: organization.name },
        membership: {
          id: membership.id,
          roleId: membership.roleId,
          role: role.name,
          status: membership.status,
        },
        user: safeUser(user),
      };
    });
  }

  async resendInvitation(auth: AuthUser, id: number) {
    this.owner(auth);
    const invitation = await this.invitations.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === 'accepted') {
      throw new BadRequestException('Accepted invitations cannot be resent');
    }
    const token = randomBytes(32).toString('hex');
    await invitation.update({
      tokenHash: this.invitationDigest(token),
      status: 'pending',
      revokedAt: null,
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      lastSentAt: new Date(),
      resentCount: Number(invitation.resentCount || 0) + 1,
    });
    return this.deliverInvitation(invitation, token);
  }

  async revokeInvitation(auth: AuthUser, id: number) {
    this.owner(auth);
    const invitation = await this.invitations.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === 'accepted') {
      throw new BadRequestException('Accepted invitations cannot be revoked');
    }
    await invitation.update({ status: 'revoked', revokedAt: new Date() });
    return { id: invitation.id, revoked: true };
  }

  async memberRole(auth: AuthUser, id: number, body: any) {
    this.owner(auth);
    const membership = await this.memberships.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!membership) throw new NotFoundException('Member not found');
    const role = await this.roles.findOne({
      where: { id: body.roleId, organizationId: auth.organizationId },
    });
    if (!role) throw new NotFoundException('Role not found');
    await membership.update({ roleId: role.id });
    return {
      id: membership.id,
      membershipId: membership.id,
      userId: membership.userId,
      roleId: membership.roleId,
      status: membership.status,
    };
  }

  async removeMember(auth: AuthUser, id: number) {
    this.owner(auth);
    const membership = await this.memberships.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.userId === auth.id)
      throw new ForbiddenException('Owner cannot remove their own membership');
    await membership.destroy();
    return { id, deleted: true };
  }

  async user(auth: AuthUser) {
    const user = await this.users.findByPk(auth.id, {
      attributes: { exclude: ['passwordHash'] },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...safeUser(user),
      organizationId: auth.organizationId,
      role: (auth.role || '').toLowerCase(),
    };
  }

  async updateUser(auth: AuthUser, body: any) {
    const user = await this.users.findByPk(auth.id);
    if (!user) throw new NotFoundException('User not found');
    await user.update({
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    });
    return this.user(auth);
  }

  async password(auth: AuthUser, body: any) {
    const user = await this.users.findByPk(auth.id);
    if (
      !user ||
      !body.currentPassword ||
      !body.newPassword ||
      !(await compare(body.currentPassword, user.passwordHash || ''))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (String(body.newPassword).length < 8)
      throw new BadRequestException(
        'New password must be at least 8 characters',
      );
    await user.update({ passwordHash: await hash(body.newPassword, 12) });
    return { passwordChanged: true };
  }

  async preferences(auth: AuthUser, body: any) {
    const user = await this.users.findByPk(auth.id);
    if (!user) throw new NotFoundException('User not found');
    await user.update({
      preferences: { ...(user.preferences as any), ...body },
    });
    return user.preferences;
  }

  async avatar(auth: AuthUser, file: any) {
    if (!file) throw new BadRequestException('avatar is required');
    const directory = join(process.cwd(), 'uploads', 'avatars');
    await mkdir(directory, { recursive: true });
    const name = `${auth.id}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await writeFile(join(directory, name), file.buffer);
    const user = await this.users.findByPk(auth.id);
    if (!user) throw new NotFoundException('User not found');
    await user.update({ avatarUrl: `/uploads/avatars/${name}` });
    return { avatarUrl: user.avatarUrl };
  }

  private async ensureStandardRoles(organizationId: number) {
    await Promise.all(
      STANDARD_ROLES.map((definition) =>
        this.roles.findOrCreate({
          where: { organizationId, name: definition.name },
          defaults: {
            organizationId,
            name: definition.name,
            description: definition.description,
            isSystem: true,
          },
        }),
      ),
    );
  }

  private async validInvitation(token: string) {
    if (!token || token.length < 32) throw this.invalidInvitation();
    const invitation = await this.invitations.findOne({
      where: { tokenHash: this.invitationDigest(token) },
    });
    this.assertInvitationUsable(invitation);
    return invitation;
  }

  private assertInvitationUsable(
    invitation: OrganizationInvitation | null,
  ): asserts invitation is OrganizationInvitation {
    if (!invitation) throw this.invalidInvitation();
    if (
      invitation.status !== 'pending' ||
      invitation.acceptedAt ||
      invitation.revokedAt
    ) {
      throw new BadRequestException({
        message: 'Invitation has already been used or revoked',
        code: 'INVITATION_NOT_ACTIVE',
      });
    }
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException({
        message: 'Invitation has expired',
        code: 'INVITATION_EXPIRED',
      });
    }
  }

  private invalidInvitation() {
    return new BadRequestException({
      message: 'Invitation token is invalid',
      code: 'INVITATION_INVALID',
    });
  }

  private invitationDigest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async deliverInvitation(
    invitation: OrganizationInvitation,
    token: string,
  ) {
    const value = invitation.toJSON() as Record<string, any>;
    delete value.tokenHash;
    const invitationUrl = `${process.env.FRONTEND_APP_URL || 'http://localhost:5173'}/accept-invitation?token=${encodeURIComponent(token)}`;
    const organization = await this.orgs.findByPk(invitation.organizationId);
    const delivered = await this.email.sendInvitation(
      invitation.email,
      invitationUrl,
      organization?.name || 'AKEEM',
    );
    return {
      ...value,
      emailDelivered: delivered,
      ...(process.env.NODE_ENV !== 'production'
        ? { invitationToken: token, invitationUrl }
        : {}),
    };
  }

  private presentMembership(membership: Membership) {
    const value = membership.toJSON() as any;
    return {
      id: membership.id,
      membershipId: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      roleId: membership.roleId,
      status: membership.status,
      jobTitle: membership.jobTitle || null,
      invitedAt: membership.invitedAt || null,
      joinedAt: membership.joinedAt || null,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      user: safeUser(value.user),
      role: value.role
        ? {
            id: value.role.id,
            name: value.role.name,
            description: value.role.description || null,
            isSystem: value.role.isSystem,
          }
        : null,
    };
  }

  private owner(auth: AuthUser) {
    if (!['owner', 'admin'].includes(String(auth.role || '').toLowerCase()))
      throw new ForbiddenException('Owner or admin permission required');
  }
}
