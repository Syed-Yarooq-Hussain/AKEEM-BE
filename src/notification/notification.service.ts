import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Notification } from '../../models';
@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification) private notifications: typeof Notification,
  ) {}
  async list(
    auth: { id: number; organizationId: number },
    page = 1,
    limit = 20,
  ) {
    const where = { userId: auth.id, organizationId: auth.organizationId };
    const { rows, count } = await this.notifications.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const unreadCount = await this.notifications.count({
      where: { ...where, readAt: null },
    });
    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.body,
        read: Boolean(n.readAt),
        resourceType: (n.data as any)?.resourceType || null,
        resourceId: (n.data as any)?.resourceId || null,
        createdAt: n.createdAt,
      })),
      unreadCount,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
  async read(auth: { id: number; organizationId: number }, id: number) {
    const item = await this.notifications.findOne({
      where: { id, userId: auth.id, organizationId: auth.organizationId },
    });
    if (!item) throw new NotFoundException('Notification not found');
    await item.update({ readAt: item.readAt || new Date() });
    return { id: item.id, read: true };
  }
  async readAll(auth: { id: number; organizationId: number }) {
    const [updated] = await this.notifications.update(
      { readAt: new Date() },
      {
        where: {
          userId: auth.id,
          organizationId: auth.organizationId,
          readAt: null,
        },
      },
    );
    return { updated };
  }
}
