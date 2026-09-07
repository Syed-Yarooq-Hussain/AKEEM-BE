import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { createHash, randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import {
  Membership,
  Organization,
  PasswordResetToken,
  RefreshToken,
  Role,
  User,
} from '../../models';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Organization)
    private readonly organizations: typeof Organization,
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    @InjectModel(RefreshToken)
    private readonly refreshTokens: typeof RefreshToken,
    @InjectModel(PasswordResetToken)
    private readonly passwordResetTokens: typeof PasswordResetToken,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly jwtService: JwtService,
    private readonly email: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findOne({ where: { email } }))
      throw new ConflictException('An account with this email already exists');

    const result = await this.sequelize.transaction(async (transaction) => {
      const baseSlug = this.slugify(dto.organizationName);
      let slug = baseSlug;
      let suffix = 1;
      while (await this.organizations.findOne({ where: { slug }, transaction }))
        slug = `${baseSlug}-${suffix++}`;

      const organization = await this.organizations.create(
        {
          name: dto.organizationName.trim(),
          slug,
          timezone: dto.timezone || 'UTC',
          currency: dto.currency || 'USD',
          status: 'active',
        },
        { transaction },
      );
      const user = await this.users.create(
        {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          passwordHash: await hash(dto.password, 12),
          status: 'active',
        },
        { transaction },
      );
      const [ownerRole] = await Promise.all([
        this.roles.create(
          {
            organizationId: organization.id,
            name: 'Owner',
            description: 'Full organization access',
            isSystem: true,
          },
          { transaction },
        ),
        this.roles.create(
          {
            organizationId: organization.id,
            name: 'Admin',
            description: 'Manage organization settings and members',
            isSystem: true,
          },
          { transaction },
        ),
        this.roles.create(
          {
            organizationId: organization.id,
            name: 'Member',
            description: 'Standard workspace access',
            isSystem: true,
          },
          { transaction },
        ),
      ]);
      await this.memberships.create(
        {
          organizationId: organization.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: 'active',
          joinedAt: new Date(),
        },
        { transaction },
      );
      return { user, organization, role: ownerRole };
    });
    return this.authResponse(
      result.user,
      result.organization,
      result.role.name,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !(await compare(dto.password, user.passwordHash))
    )
      throw new UnauthorizedException('Invalid email or password');
    if (user.status !== 'active')
      throw new UnauthorizedException('Account is not active');
    const membership = await this.memberships.findOne({
      where: { userId: user.id, status: 'active' },
      include: [Organization, Role],
    });
    if (!membership)
      throw new UnauthorizedException(
        'No active organization membership found',
      );
    await user.update({ lastLoginAt: new Date() });
    return this.authResponse(
      user,
      membership.organization,
      membership.role?.name,
    );
  }

  async me(auth: { id: number; organizationId: number; role?: string }) {
    const [user, organization] = await Promise.all([
      this.users.findByPk(auth.id),
      this.organizations.findByPk(auth.organizationId),
    ]);
    if (!user || !organization) throw new UnauthorizedException();
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      role: (auth.role || '').toLowerCase(),
      organizationId: organization.id,
      organization: {
        id: organization.id,
        name: organization.name,
        timezone: organization.timezone,
        currency: organization.currency,
      },
    };
  }

  async refresh(token: string) {
    const record = await this.refreshTokens.findOne({
      where: {
        tokenHash: this.digest(token),
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!record)
      throw new UnauthorizedException('Invalid or expired refresh token');
    const membership = await this.memberships.findOne({
      where: {
        userId: record.userId,
        organizationId: record.organizationId,
        status: 'active',
      },
      include: [Role],
    });
    if (!membership)
      throw new UnauthorizedException('Membership is no longer active');
    const user = await this.users.findByPk(record.userId);
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    await record.update({ revokedAt: new Date() });
    return this.issueTokens(user, record.organizationId, membership.role?.name);
  }

  async logout(token?: string) {
    if (token)
      await this.refreshTokens.update(
        { revokedAt: new Date() },
        { where: { tokenHash: this.digest(token), revokedAt: null } },
      );
    return { loggedOut: true };
  }

  async forgotPassword(rawEmail: string) {
    const user = await this.users.findOne({
      where: { email: rawEmail.trim().toLowerCase() },
    });
    let resetToken: string | undefined;
    if (user) {
      resetToken = randomBytes(32).toString('hex');
      await this.passwordResetTokens.create({
        userId: user.id,
        tokenHash: this.digest(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      // Wire an email provider here; never disclose token in production.
    }
    const resetUrl = resetToken
      ? `${process.env.FRONTEND_APP_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(resetToken)}`
      : undefined;
    if (user && resetUrl)
      await this.email.sendPasswordReset(user.email, resetUrl);
    return {
      message:
        'If the account exists, password reset instructions have been sent',
      ...(process.env.NODE_ENV !== 'production' && resetToken
        ? { resetToken, resetUrl }
        : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.passwordResetTokens.findOne({
      where: {
        tokenHash: this.digest(token),
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!record)
      throw new UnauthorizedException('Invalid or expired reset token');
    const user = await this.users.findByPk(record.userId);
    if (!user) throw new UnauthorizedException();
    await this.sequelize.transaction(async (transaction) => {
      await user.update(
        { passwordHash: await hash(password, 12) },
        { transaction },
      );
      await record.update({ usedAt: new Date() }, { transaction });
      await this.refreshTokens.update(
        { revokedAt: new Date() },
        { where: { userId: user.id, revokedAt: null }, transaction },
      );
    });
    return { passwordReset: true };
  }

  async validateUserByJwt(
    userId: number,
    organizationId: number,
    role?: string,
  ) {
    const user = await this.users.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] },
    });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const membership = await this.memberships.findOne({
      where: { userId, organizationId, status: 'active' },
    });
    if (!membership) throw new UnauthorizedException();
    return { ...user.toJSON(), organizationId, role };
  }

  private async authResponse(
    user: User,
    organization: Organization,
    role?: string,
  ) {
    const tokens = await this.issueTokens(user, organization.id, role);
    return {
      ...tokens,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        role: (role || '').toLowerCase(),
        organizationId: organization.id,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        timezone: organization.timezone,
        currency: organization.currency,
      },
    };
  }

  private async issueTokens(user: User, organizationId: number, role?: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.create({
      userId: user.id,
      organizationId,
      tokenHash: this.digest(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return {
      accessToken: this.jwtService.sign({ sub: user.id, organizationId, role }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private slugify(value: string) {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'workspace'
    );
  }
}
