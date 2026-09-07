import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  AiConversation,
  AiMessage,
  AuditLog,
  Integration,
  Membership,
  Role,
  User,
} from '../../models';
import { safeUser } from '../common/safe-user';
import { CredentialEncryptionService } from './credential-encryption.service';

type AuthUser = { id: number; organizationId: number; role?: string };

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Membership) private readonly members: typeof Membership,
    @InjectModel(AiConversation)
    private readonly conversations: typeof AiConversation,
    @InjectModel(AiMessage) private readonly messages: typeof AiMessage,
    @InjectModel(AuditLog) private readonly audits: typeof AuditLog,
    @InjectModel(Integration)
    private readonly integrationsModel: typeof Integration,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  async users(auth: AuthUser) {
    this.guard(auth);
    const rows = await this.members.findAll({
      where: { organizationId: auth.organizationId },
      include: [
        { model: User, attributes: { exclude: ['passwordHash'] } },
        Role,
      ],
      order: [['createdAt', 'ASC']],
    });
    return rows.map((membership) => {
      const value = membership.toJSON() as any;
      return {
        id: membership.id,
        membershipId: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        roleId: membership.roleId,
        status: membership.status,
        jobTitle: membership.jobTitle || null,
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
    });
  }

  async usage(auth: AuthUser, period?: string) {
    this.guard(auth);
    const start =
      period && /^\d{4}-\d{2}$/.test(period)
        ? new Date(`${period}-01T00:00:00Z`)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    const conversations = await this.conversations.findAll({
      where: { organizationId: auth.organizationId },
      attributes: ['id'],
    });
    const ids = conversations.map((conversation) => conversation.id);
    const rows = ids.length
      ? await this.messages.findAll({
          where: {
            conversationId: { [Op.in]: ids },
            role: 'assistant',
            createdAt: { [Op.gte]: start, [Op.lt]: next },
          },
          attributes: ['inputTokens', 'outputTokens'],
        })
      : [];
    const inputTokens = rows.reduce(
      (sum, item) => sum + Number(item.inputTokens || 0),
      0,
    );
    const outputTokens = rows.reduce(
      (sum, item) => sum + Number(item.outputTokens || 0),
      0,
    );
    return {
      period: start.toISOString().slice(0, 7),
      inputTokens,
      outputTokens,
      aiRequests: rows.length,
      estimatedCost: Number(
        ((inputTokens * 0.4 + outputTokens * 1.6) / 1000000).toFixed(4),
      ),
      currency: 'USD',
    };
  }

  async logs(auth: AuthUser, query: any) {
    this.guard(auth);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const { rows, count } = await this.audits.findAndCountAll({
      where: { organizationId: auth.organizationId },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return {
      items: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async integrations(auth: AuthUser) {
    this.guard(auth);
    return this.integrationsModel.findAll({
      where: { organizationId: auth.organizationId },
      attributes: { exclude: ['credentialsEncrypted'] },
      order: [['createdAt', 'DESC']],
    });
  }

  async createIntegration(auth: AuthUser, body: any) {
    this.guard(auth);
    const integration = await this.integrationsModel.create({
      organizationId: auth.organizationId,
      provider: body.provider,
      displayName: body.displayName,
      status: body.status || 'connected',
      credentialsEncrypted: this.encryption.encrypt(body.credentials || {}),
      settings: body.settings || {},
    });
    return this.presentIntegration(integration);
  }

  async updateIntegration(auth: AuthUser, id: number, body: any) {
    this.guard(auth);
    const integration = await this.one(auth, id);
    await integration.update({
      displayName: body.displayName,
      status: body.status,
      settings: body.settings,
      ...(body.credentials
        ? { credentialsEncrypted: this.encryption.encrypt(body.credentials) }
        : {}),
    });
    return this.presentIntegration(integration);
  }

  async removeIntegration(auth: AuthUser, id: number) {
    this.guard(auth);
    const integration = await this.one(auth, id);
    await integration.destroy();
    return { id, deleted: true };
  }

  private async one(auth: AuthUser, id: number) {
    const integration = await this.integrationsModel.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }

  private presentIntegration(integration: Integration) {
    const value = integration.toJSON() as Record<string, any>;
    delete value.credentialsEncrypted;
    return value;
  }

  private guard(auth: AuthUser) {
    if (!['owner', 'admin'].includes(String(auth.role || '').toLowerCase()))
      throw new ForbiddenException('Owner or admin permission required');
  }
}
