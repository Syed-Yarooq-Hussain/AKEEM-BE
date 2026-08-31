import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { Sequelize } from 'sequelize-typescript';
import { compare, hash } from 'bcryptjs';
import { Membership, Organization, Role, User } from '../../models';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Organization) private readonly organizations: typeof Organization,
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findOne({ where: { email } })) throw new ConflictException('An account with this email already exists');

    const result = await this.sequelize.transaction(async (transaction) => {
      const baseSlug = this.slugify(dto.organizationName);
      let slug = baseSlug;
      let suffix = 1;
      while (await this.organizations.findOne({ where: { slug }, transaction })) slug = `${baseSlug}-${suffix++}`;

      const organization = await this.organizations.create({
        name: dto.organizationName.trim(), slug, timezone: dto.timezone || 'UTC',
        currency: dto.currency || 'USD', status: 'active',
      }, { transaction });
      const user = await this.users.create({
        firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email,
        passwordHash: await hash(dto.password, 12), status: 'active',
      }, { transaction });
      const ownerRole = await this.roles.create({
        organizationId: organization.id, name: 'Owner', description: 'Full organization access', isSystem: true,
      }, { transaction });
      await this.memberships.create({
        organizationId: organization.id, userId: user.id, roleId: ownerRole.id,
        status: 'active', joinedAt: new Date(),
      }, { transaction });
      return { user, organization, role: ownerRole };
    });
    return this.authResponse(result.user, result.organization, result.role.name);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    if (user.status !== 'active') throw new UnauthorizedException('Account is not active');
    const membership = await this.memberships.findOne({ where: { userId: user.id, status: 'active' }, include: [Organization, Role] });
    if (!membership) throw new UnauthorizedException('No active organization membership found');
    await user.update({ lastLoginAt: new Date() });
    return this.authResponse(user, membership.organization, membership.role?.name);
  }

  async validateUserByJwt(userId: number, organizationId: number, role?: string) {
    const user = await this.users.findByPk(userId, { attributes: { exclude: ['passwordHash'] } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const membership = await this.memberships.findOne({ where: { userId, organizationId, status: 'active' } });
    if (!membership) throw new UnauthorizedException();
    return { ...user.toJSON(), organizationId, role };
  }

  private authResponse(user: User, organization: Organization, role?: string) {
    return {
      accessToken: this.jwtService.sign({ sub: user.id, organizationId: organization.id, role }),
      tokenType: 'Bearer', expiresIn: 3600,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, avatarUrl: user.avatarUrl },
      organization: { id: organization.id, name: organization.name, slug: organization.slug }, role,
    };
  }

  private slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
  }
}
