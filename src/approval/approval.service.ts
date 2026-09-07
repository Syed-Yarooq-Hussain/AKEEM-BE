import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiAgent, Approval, Project, User } from '../../models';
@Injectable()
export class ApprovalService {
  constructor(
    @InjectModel(Approval) private m: typeof Approval,
    @InjectModel(Project) private projects: typeof Project,
    @InjectModel(User) private users: typeof User,
    @InjectModel(AiAgent) private agents: typeof AiAgent,
  ) {}
  async list(a: any, p?: number, status?: string) {
    const w: any = { organizationId: a.organizationId };
    if (p) w.projectId = p;
    if (status) w.status = status;
    const rows = await this.m.findAll({
      where: w,
      order: [['createdAt', 'DESC']],
    });
    return Promise.all(rows.map((x) => this.present(x)));
  }
  async create(a: any, b: any) {
    if (!b.title || !b.type)
      throw new UnprocessableEntityException('title and type are required');
    if (
      b.projectId &&
      !(await this.projects.findOne({
        where: { id: b.projectId, organizationId: a.organizationId },
      }))
    )
      throw new NotFoundException('Project not found in your organization');
    return this.m.create({
      organizationId: a.organizationId,
      projectId: b.projectId,
      requestedByUserId: a.id,
      title: b.title,
      type: b.type,
      amount: b.amount,
      currency: b.currency || 'USD',
      description: b.description,
      status: 'pending',
      metadata: b.metadata || {},
    });
  }
  async one(a: any, id: number) {
    const x = await this.raw(a, id);
    return this.present(x);
  }
  async review(a: any, id: number, status: string, comment?: string) {
    const x = await this.raw(a, id);
    if (x.status !== 'pending')
      throw new UnprocessableEntityException(
        'Approval has already been reviewed',
      );
    await x.update({
      status,
      reviewComment: comment,
      reviewedById: a.id,
      reviewedAt: new Date(),
    });
    return this.present(x);
  }
  async raw(a: any, id: number) {
    const x = await this.m.findOne({
      where: { id, organizationId: a.organizationId },
    });
    if (!x) throw new NotFoundException('Approval not found');
    return x;
  }
  async present(x: Approval) {
    let requestedBy: any = null;
    if (x.requestedByUserId) {
      const u = await this.users.findByPk(x.requestedByUserId);
      if (u) requestedBy = { id: u.id, name: `${u.firstName} ${u.lastName}` };
    } else if (x.requestedByAgentId) {
      const ag = await this.agents.findByPk(x.requestedByAgentId);
      if (ag) requestedBy = { id: ag.id, name: ag.name };
    }
    return { ...x.toJSON(), requestedBy };
  }
}
