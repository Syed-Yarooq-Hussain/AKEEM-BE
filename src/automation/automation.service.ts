import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Automation, AutomationRun, Project } from '../../models';
@Injectable()
export class AutomationService {
  constructor(
    @InjectModel(Automation) private m: typeof Automation,
    @InjectModel(AutomationRun) private runsModel: typeof AutomationRun,
    @InjectModel(Project) private projects: typeof Project,
  ) {}
  async list(a: any, p?: number) {
    const rows = await this.m.findAll({
      where: {
        organizationId: a.organizationId,
        ...(p ? { projectId: p } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
    return rows.map((x) => this.present(x));
  }
  async project(a: any, id?: number) {
    if (
      id &&
      !(await this.projects.findOne({
        where: { id, organizationId: a.organizationId },
      }))
    )
      throw new NotFoundException('Project not found in your organization');
  }
  async create(a: any, b: any) {
    if (!b.name || !b.trigger)
      throw new UnprocessableEntityException('name and trigger are required');
    await this.project(a, b.projectId);
    return this.present(
      await this.m.create({
        organizationId: a.organizationId,
        createdById: a.id,
        projectId: b.projectId,
        name: b.name,
        description: b.description,
        trigger: b.trigger,
        actions: b.actions || [],
        isActive: b.enabled ?? b.isActive ?? false,
        nextRunAt: b.nextRunAt,
      }),
    );
  }
  async raw(a: any, id: number) {
    const x = await this.m.findOne({
      where: { id, organizationId: a.organizationId },
    });
    if (!x) throw new NotFoundException('Automation not found');
    return x;
  }
  async one(a: any, id: number) {
    return this.present(await this.raw(a, id));
  }
  async update(a: any, id: number, b: any) {
    const x = await this.raw(a, id);
    await this.project(a, b.projectId);
    await x.update({ ...b, isActive: b.enabled ?? b.isActive });
    return this.present(x);
  }
  async remove(a: any, id: number) {
    const x = await this.raw(a, id);
    await x.destroy();
    return { id, deleted: true };
  }
  async run(a: any, id: number) {
    const x = await this.raw(a, id);
    const run = await this.runsModel.create({
      organizationId: a.organizationId,
      automationId: id,
      status: 'completed',
      input: { manual: true },
      output: { message: 'Automation queued/executed' },
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await x.update({ lastRunAt: new Date() });
    return run;
  }
  async runs(a: any, id: number) {
    await this.raw(a, id);
    return this.runsModel.findAll({
      where: { organizationId: a.organizationId, automationId: id },
      order: [['createdAt', 'DESC']],
    });
  }
  present(x: Automation) {
    return { ...x.toJSON(), enabled: x.isActive };
  }
}
