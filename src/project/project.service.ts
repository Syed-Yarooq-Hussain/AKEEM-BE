import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Company, Contact, Deal, Project } from '../../models';
import { CreateProjectDto } from './dto/create-project.dto';

type AuthUser = { id: number; organizationId: number };

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Company) private readonly companies: typeof Company,
    @InjectModel(Contact) private readonly contacts: typeof Contact,
    @InjectModel(Deal) private readonly deals: typeof Deal,
  ) {}

  async create(auth: AuthUser, dto: CreateProjectDto) {
    await this.validateRelations(auth.organizationId, dto);
    if (dto.startDate && dto.dueDate && new Date(dto.dueDate) < new Date(dto.startDate)) {
      throw new BadRequestException('dueDate must be on or after startDate');
    }
    return this.projects.create({
      organizationId: auth.organizationId, ownerId: auth.id,
      name: dto.name.trim(), description: dto.description?.trim(), status: dto.status || 'planned',
      color: dto.color, startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, budget: dto.budget,
      companyId: dto.companyId, contactId: dto.contactId, dealId: dto.dealId, settings: {},
    });
  }

  findAll(auth: AuthUser) {
    return this.projects.findAll({ where: { organizationId: auth.organizationId }, order: [['createdAt', 'DESC']] });
  }

  async findOne(auth: AuthUser, id: number) {
    const project = await this.projects.findOne({ where: { id, organizationId: auth.organizationId } });
    if (!project) throw new NotFoundException('Project not found in your organization');
    return project;
  }

  private async validateRelations(organizationId: number, dto: CreateProjectDto) {
    const checks = [
      dto.companyId && this.companies.findOne({ where: { id: dto.companyId, organizationId } }),
      dto.contactId && this.contacts.findOne({ where: { id: dto.contactId, organizationId } }),
      dto.dealId && this.deals.findOne({ where: { id: dto.dealId, organizationId } }),
    ].filter(Boolean);
    const results = await Promise.all(checks);
    if (results.some((record) => !record)) throw new BadRequestException('A linked company, contact, or deal does not belong to your organization');
  }
}
