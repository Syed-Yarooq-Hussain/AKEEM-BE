import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiTask, Project } from '../../models';
import { CeoChatService } from '../ceo-chat/ceo-chat.service';
import {
  AiTaskQueryDto,
  CreateAiTaskDto,
  UpdateAiTaskDto,
} from './dto/ai-task.dto';

type Auth = { id: number; organizationId: number };

@Injectable()
export class AiTaskService {
  constructor(
    @InjectModel(AiTask) private readonly tasks: typeof AiTask,
    @InjectModel(Project) private readonly projects: typeof Project,
    private readonly chat: CeoChatService,
  ) {}

  async create(auth: Auth, dto: CreateAiTaskDto) {
    await this.project(auth, dto.projectId);
    const { runNow, executionMode, ...record } = dto;
    const task = await this.tasks.create({
      ...record,
      organizationId: auth.organizationId,
      createdById: auth.id,
      status: 'queued',
      progress: 0,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      input: { ...(dto.input || {}), executionMode: executionMode || 'auto' },
      output: {},
      attemptCount: 0,
    });
    return runNow === false ? task : this.run(auth, task.id);
  }

  async list(auth: Auth, query: AiTaskQueryDto) {
    const where: any = { organizationId: auth.organizationId };
    for (const key of ['projectId', 'status', 'assistant'])
      if (query[key] !== undefined) where[key] = query[key];
    const { rows, count } = await this.tasks.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return {
      items: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count,
        totalPages: Math.ceil(count / query.limit),
      },
    };
  }

  async one(auth: Auth, id: number) {
    const task = await this.tasks.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!task) throw new NotFoundException('AI task not found');
    return task;
  }

  async update(auth: Auth, id: number, dto: UpdateAiTaskDto) {
    const task = await this.one(auth, id);
    if (dto.projectId) await this.project(auth, dto.projectId);
    const { runNow, executionMode, ...record } = dto;
    await task.update({
      ...record,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : task.dueDate,
      input: executionMode
        ? { ...(task.input as any), executionMode }
        : task.input,
    });
    return runNow ? this.run(auth, task.id) : task;
  }

  async run(auth: Auth, id: number) {
    const task = await this.one(auth, id);
    if (task.status === 'running')
      throw new UnprocessableEntityException('AI task is already running');
    if (task.status === 'completed')
      throw new UnprocessableEntityException('AI task has already completed');
    await task.update({
      status: 'running',
      progress: 10,
      error: null,
      startedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
      attemptCount: Number(task.attemptCount || 0) + 1,
    });
    try {
      const input = (task.input || {}) as any;
      const result = await this.chat.chat(
        auth,
        {
          projectId: task.projectId,
          message: task.description?.trim() || task.title,
          executionMode: input.executionMode === 'suggest' ? 'suggest' : 'auto',
          context: {
            module: 'ai-tasks',
            page: 'task-runner',
            entityType: 'ai_task',
            entityId: task.id,
            selection: input,
          },
        },
        task.assistant,
      );
      await task.update({
        status: 'completed',
        progress: 100,
        output: {
          conversationId: result.conversationId,
          messageId: result.messageId,
          answer: result.answer,
          routing: result.routing,
          delegations: result.delegations,
          actions: result.actions,
          usage: result.usage,
        },
        completedAt: new Date(),
      });
    } catch (error) {
      await task.update({
        status: 'failed',
        progress: 100,
        error:
          error instanceof Error ? error.message : 'AI task execution failed',
        completedAt: new Date(),
      });
    }
    return task.reload();
  }

  async cancel(auth: Auth, id: number) {
    const task = await this.one(auth, id);
    if (['completed', 'cancelled'].includes(task.status))
      throw new UnprocessableEntityException('Task cannot be cancelled');
    return task.update({ status: 'cancelled', cancelledAt: new Date() });
  }

  async retry(auth: Auth, id: number) {
    const task = await this.one(auth, id);
    if (!['failed', 'cancelled'].includes(task.status))
      throw new UnprocessableEntityException(
        'Only failed or cancelled tasks can be retried',
      );
    await task.update({
      status: 'queued',
      progress: 0,
      error: null,
      cancelledAt: null,
      completedAt: null,
    });
    return this.run(auth, id);
  }

  private async project(auth: Auth, id: number) {
    if (
      !(await this.projects.findOne({
        where: { id, organizationId: auth.organizationId },
      }))
    ) {
      throw new NotFoundException('Project not found in your organization');
    }
  }
}
