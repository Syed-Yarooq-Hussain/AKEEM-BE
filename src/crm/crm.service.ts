import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Company, Contact, Deal, Pipeline, PipelineStage } from '../../models';

const DEFAULT_STAGES = [
  { name: 'Lead', position: 0, probability: 10, color: '#64748b' },
  { name: 'Qualified', position: 1, probability: 30, color: '#3b82f6' },
  { name: 'Proposal', position: 2, probability: 60, color: '#8b5cf6' },
  { name: 'Negotiation', position: 3, probability: 80, color: '#f59e0b' },
  { name: 'Won', position: 4, probability: 100, color: '#10b981' },
  { name: 'Lost', position: 5, probability: 0, color: '#ef4444' },
];

type AuthUser = { id: number; organizationId: number };

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Company) private readonly companies: typeof Company,
    @InjectModel(Contact) private readonly contacts: typeof Contact,
    @InjectModel(Deal) private readonly deals: typeof Deal,
    @InjectModel(Pipeline) private readonly pipelinesModel: typeof Pipeline,
    @InjectModel(PipelineStage)
    private readonly stages: typeof PipelineStage,
  ) {}

  async pipelines(auth: AuthUser) {
    await this.defaultPipeline(auth.organizationId);
    const pipelines = await this.pipelinesModel.findAll({
      where: { organizationId: auth.organizationId },
      order: [
        ['isDefault', 'DESC'],
        ['name', 'ASC'],
      ],
    });
    return Promise.all(
      pipelines.map(async (pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        isDefault: pipeline.isDefault,
        stages: (
          await this.stages.findAll({
            where: { pipelineId: pipeline.id },
            order: [['position', 'ASC']],
          })
        ).map((stage) => ({
          id: stage.id,
          pipelineId: stage.pipelineId,
          name: stage.name,
          position: stage.position,
          probability: stage.probability,
          color: stage.color || null,
        })),
      })),
    );
  }

  async list(auth: AuthUser, resource: string, query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: any = { organizationId: auth.organizationId };
    if (query.search) {
      where[Op.or] =
        resource === 'companies'
          ? [{ name: { [Op.iLike]: `%${query.search}%` } }]
          : resource === 'contacts'
            ? [
                { firstName: { [Op.iLike]: `%${query.search}%` } },
                { lastName: { [Op.iLike]: `%${query.search}%` } },
                { email: { [Op.iLike]: `%${query.search}%` } },
              ]
            : [{ title: { [Op.iLike]: `%${query.search}%` } }];
    }
    const { rows, count } = await this.model(resource).findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });
    return {
      items:
        resource === 'deals'
          ? await Promise.all(rows.map((deal) => this.presentDeal(deal)))
          : rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async create(auth: AuthUser, resource: string, body: any) {
    if (resource === 'deals') {
      const defaultData = await this.defaultPipeline(auth.organizationId);
      const stage = body.stageId
        ? await this.stages.findOne({
            where: { id: body.stageId, pipelineId: defaultData.pipeline.id },
          })
        : defaultData.stage;
      if (!stage)
        throw new UnprocessableEntityException(
          'Pipeline stage does not belong to the selected pipeline',
        );
      return this.presentDeal(
        await this.deals.create({
          organizationId: auth.organizationId,
          pipelineId: defaultData.pipeline.id,
          stageId: stage.id,
          title: body.name || body.title,
          value: body.value || 0,
          currency: body.currency || 'USD',
          companyId: body.companyId,
          contactId: body.contactId,
          ownerId: body.ownerId || auth.id,
          expectedCloseDate: body.expectedCloseDate,
          status: 'open',
        }),
      );
    }
    return this.model(resource).create({
      ...body,
      organizationId: auth.organizationId,
      ownerId: resource === 'contacts' ? body.ownerId || auth.id : undefined,
    });
  }

  async one(auth: AuthUser, resource: string, id: number) {
    const value = await this.oneRaw(auth, resource, id);
    return resource === 'deals' ? this.presentDeal(value) : value;
  }

  async update(auth: AuthUser, resource: string, id: number, body: any) {
    const value: any = await this.oneRaw(auth, resource, id);
    if (resource === 'deals' && body.name) {
      body.title = body.name;
      delete body.name;
    }
    await value.update(body);
    return resource === 'deals' ? this.presentDeal(value) : value;
  }

  async remove(auth: AuthUser, resource: string, id: number) {
    const value = await this.oneRaw(auth, resource, id);
    await value.destroy();
    return { id, deleted: true };
  }

  async stage(auth: AuthUser, id: number, body: any) {
    const deal = await this.oneRaw(auth, 'deals', id);
    const pipeline = await this.pipelinesModel.findOne({
      where: { id: deal.pipelineId, organizationId: auth.organizationId },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    if (pipeline.isDefault) await this.ensureDefaultStages(pipeline.id);

    const stage = body.stageId
      ? await this.stages.findOne({
          where: { id: body.stageId, pipelineId: pipeline.id },
        })
      : body.stage
        ? await this.stages.findOne({
            where: {
              pipelineId: pipeline.id,
              name: { [Op.iLike]: String(body.stage) },
            },
          })
        : null;
    if (!stage)
      throw new UnprocessableEntityException('Pipeline stage not found');
    const normalized = stage.name.toLowerCase();
    const inferredStatus =
      normalized === 'won'
        ? 'won'
        : normalized === 'lost'
          ? 'lost'
          : deal.status === 'won' || deal.status === 'lost'
            ? 'open'
            : deal.status;
    await deal.update({
      stageId: stage.id,
      status: body.status || inferredStatus,
    });
    return this.presentDeal(deal);
  }

  async overview(auth: AuthUser) {
    const [companies, contacts, openDeals, wonDeals, value] = await Promise.all(
      [
        this.companies.count({
          where: { organizationId: auth.organizationId },
        }),
        this.contacts.count({
          where: { organizationId: auth.organizationId },
        }),
        this.deals.count({
          where: { organizationId: auth.organizationId, status: 'open' },
        }),
        this.deals.count({
          where: { organizationId: auth.organizationId, status: 'won' },
        }),
        this.deals.sum('value', {
          where: { organizationId: auth.organizationId, status: 'open' },
        }),
      ],
    );
    return {
      companies,
      contacts,
      openDeals,
      wonDeals,
      pipelineValue: Number(value || 0),
    };
  }

  private model(resource: string): any {
    const model = {
      companies: this.companies,
      contacts: this.contacts,
      deals: this.deals,
    }[resource];
    if (!model) throw new NotFoundException('CRM resource not found');
    return model;
  }

  private async oneRaw(auth: AuthUser, resource: string, id: number) {
    const value = await this.model(resource).findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!value)
      throw new NotFoundException(`${resource.slice(0, -1)} not found`);
    return value;
  }

  private async defaultPipeline(organizationId: number) {
    const [pipeline] = await this.pipelinesModel.findOrCreate({
      where: { organizationId, isDefault: true },
      defaults: {
        organizationId,
        name: 'Sales',
        isDefault: true,
      },
    });
    await this.ensureDefaultStages(pipeline.id);
    const stage = await this.stages.findOne({
      where: { pipelineId: pipeline.id, name: 'Lead' },
    });
    return { pipeline, stage };
  }

  private async ensureDefaultStages(pipelineId: number) {
    await Promise.all(
      DEFAULT_STAGES.map((definition) =>
        this.stages.findOrCreate({
          where: { pipelineId, name: definition.name },
          defaults: { pipelineId, ...definition },
        }),
      ),
    );
  }

  private async presentDeal(deal: Deal) {
    const stage = await this.stages.findByPk(deal.stageId);
    return {
      ...deal.toJSON(),
      name: deal.title,
      stage: stage?.name || null,
      probability: stage?.probability || 0,
    };
  }
}
