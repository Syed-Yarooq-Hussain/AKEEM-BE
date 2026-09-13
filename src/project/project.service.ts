import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  Company,
  Contact,
  Deal,
  Organization,
  Project,
  Task,
  User,
} from '../../models';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

type AuthUser = { id: number; organizationId: number };

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Company) private readonly companies: typeof Company,
    @InjectModel(Contact) private readonly contacts: typeof Contact,
    @InjectModel(Deal) private readonly deals: typeof Deal,
    @InjectModel(Task) private readonly tasks: typeof Task,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Organization)
    private readonly organizations: typeof Organization,
  ) {}

  async create(auth: AuthUser, dto: CreateProjectDto) {
    await this.validateRelations(auth.organizationId, dto);
    if (
      dto.startDate &&
      dto.dueDate &&
      new Date(dto.dueDate) < new Date(dto.startDate)
    ) {
      throw new BadRequestException('dueDate must be on or after startDate');
    }
    const project = await this.projects.create({
      organizationId: auth.organizationId,
      ownerId: auth.id,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      status: dto.status || 'planned',
      color: dto.color,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      budget: dto.budget,
      companyId: dto.companyId,
      contactId: dto.contactId,
      dealId: dto.dealId,
      settings: {},
    });
    return this.present(project, auth);
  }

  async findAll(auth: AuthUser, query: ProjectQueryDto) {
    const where: any = { organizationId: auth.organizationId };
    if (query.status) where.status = query.status;
    if (query.search)
      where[Op.or] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } },
      ];
    const { rows, count } = await this.projects.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return {
      items: await Promise.all(
        rows.map((project) => this.present(project, auth)),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count,
        totalPages: Math.ceil(count / query.limit),
      },
    };
  }

  async findOne(auth: AuthUser, id: number) {
    const project = await this.projects.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!project)
      throw new NotFoundException('Project not found in your organization');
    return this.present(project, auth);
  }

  async update(auth: AuthUser, id: number, dto: UpdateProjectDto) {
    const project = await this.requireProject(auth, id);
    await this.validateRelations(auth.organizationId, dto);
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : project.startDate;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : project.dueDate;
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate))
      throw new BadRequestException('dueDate must be on or after startDate');
    await project.update({
      ...dto,
      startDate,
      dueDate,
    });
    return this.present(project, auth);
  }

  async archive(auth: AuthUser, id: number) {
    const project = await this.requireProject(auth, id);
    await project.update({ status: 'archived' });
    return { id: project.id, status: project.status };
  }

  private async requireProject(auth: AuthUser, id: number) {
    const project = await this.projects.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!project)
      throw new NotFoundException('Project not found in your organization');
    return project;
  }

  private async present(project: Project, auth: AuthUser) {
    const [allTasks, doneTasks, owner, organization] = await Promise.all([
      this.tasks.count({
        where: { projectId: project.id, organizationId: auth.organizationId },
      }),
      this.tasks.count({
        where: {
          projectId: project.id,
          organizationId: auth.organizationId,
          status: 'done',
        },
      }),
      project.ownerId ? this.users.findByPk(project.ownerId) : null,
      this.organizations.findByPk(auth.organizationId),
    ]);
    return {
      ...project.toJSON(),
      currency: organization?.currency || 'USD',
      progress: allTasks ? Math.round((doneTasks * 100) / allTasks) : 0,
      owner: owner
        ? { id: owner.id, name: `${owner.firstName} ${owner.lastName}` }
        : null,
    };
  }

  private async validateRelations(
    organizationId: number,
    dto: CreateProjectDto | UpdateProjectDto,
  ) {
    const checks = [
      dto.companyId &&
        this.companies.findOne({
          where: { id: dto.companyId, organizationId },
        }),
      dto.contactId &&
        this.contacts.findOne({ where: { id: dto.contactId, organizationId } }),
      dto.dealId &&
        this.deals.findOne({ where: { id: dto.dealId, organizationId } }),
    ].filter(Boolean);
    const results = await Promise.all(checks);
    if (results.some((record) => !record))
      throw new BadRequestException(
        'A linked company, contact, or deal does not belong to your organization',
      );
  }
}
