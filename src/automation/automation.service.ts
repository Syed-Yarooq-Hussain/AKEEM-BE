import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { CronExpressionParser } from 'cron-parser';
import { Op, UniqueConstraintError } from 'sequelize';
import {
  Approval,
  AuditLog,
  Automation,
  AutomationRun,
  Budget,
  CrmActivity,
  Project,
  Report,
  Task,
} from '../../models';

type Auth = { id: number; organizationId: number };
type AutomationAction = {
  type?: string;
  payload?: Record<string, any>;
  [key: string]: any;
};

@Injectable()
export class AutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationService.name);
  private timer?: NodeJS.Timeout;
  private working = false;

  constructor(
    @InjectModel(Automation) private readonly automations: typeof Automation,
    @InjectModel(AutomationRun)
    private readonly runsModel: typeof AutomationRun,
    @InjectModel(Project) private readonly projects: typeof Project,
    @InjectModel(Task) private readonly tasks: typeof Task,
    @InjectModel(Report) private readonly reports: typeof Report,
    @InjectModel(Approval) private readonly approvals: typeof Approval,
    @InjectModel(Budget) private readonly budgets: typeof Budget,
    @InjectModel(CrmActivity) private readonly activities: typeof CrmActivity,
    @InjectModel(AuditLog) private readonly audits: typeof AuditLog,
  ) {}

  async onModuleInit() {
    await this.runsModel.update(
      {
        status: 'queued',
        lockedAt: null,
        availableAt: new Date(),
        failureReason: 'Recovered after worker restart',
      },
      { where: { status: 'running' } },
    );
    if (process.env.AUTOMATION_WORKER_ENABLED !== 'false') {
      const interval = Math.max(
        500,
        Number(process.env.AUTOMATION_POLL_INTERVAL_MS || 2_000),
      );
      this.timer = setInterval(() => void this.tick(), interval);
      this.timer.unref();
      setImmediate(() => void this.tick());
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  isWorkerReady() {
    return (
      process.env.AUTOMATION_WORKER_ENABLED !== 'false' && Boolean(this.timer)
    );
  }

  async list(auth: Auth, projectId?: number) {
    await this.project(auth, projectId);
    const rows = await this.automations.findAll({
      where: {
        organizationId: auth.organizationId,
        ...(projectId ? { projectId } : {}),
      },
      order: [['createdAt', 'DESC']],
    });
    return rows.map((automation) => this.present(automation));
  }

  async create(auth: Auth, body: any) {
    if (!body.name || !body.trigger) {
      throw new UnprocessableEntityException('name and trigger are required');
    }
    await this.project(auth, body.projectId);
    const active = body.enabled ?? body.isActive ?? false;
    const nextRunAt = body.nextRunAt
      ? new Date(body.nextRunAt)
      : active
        ? this.nextRun(body.trigger)
        : undefined;
    return this.present(
      await this.automations.create({
        organizationId: auth.organizationId,
        createdById: auth.id,
        projectId: body.projectId,
        name: body.name,
        description: body.description,
        trigger: body.trigger,
        actions: Array.isArray(body.actions) ? body.actions : [],
        isActive: active,
        nextRunAt,
        retryLimit: this.integer(body.retryLimit, 3, 0, 10),
        timeoutSeconds: this.integer(body.timeoutSeconds, 60, 5, 300),
      }),
    );
  }

  async one(auth: Auth, id: number) {
    return this.present(await this.raw(auth, id));
  }

  async update(auth: Auth, id: number, body: any) {
    const automation = await this.raw(auth, id);
    await this.project(auth, body.projectId);
    const active = body.enabled ?? body.isActive ?? automation.isActive;
    await automation.update({
      name: body.name,
      description: body.description,
      projectId: body.projectId,
      trigger: body.trigger,
      actions: body.actions,
      isActive: active,
      retryLimit:
        body.retryLimit === undefined
          ? automation.retryLimit
          : this.integer(body.retryLimit, 3, 0, 10),
      timeoutSeconds:
        body.timeoutSeconds === undefined
          ? automation.timeoutSeconds
          : this.integer(body.timeoutSeconds, 60, 5, 300),
      nextRunAt: body.nextRunAt
        ? new Date(body.nextRunAt)
        : active && (!automation.nextRunAt || body.trigger)
          ? this.nextRun(body.trigger || automation.trigger)
          : active
            ? automation.nextRunAt
            : null,
    });
    return this.present(automation);
  }

  async remove(auth: Auth, id: number) {
    const automation = await this.raw(auth, id);
    await automation.destroy();
    return { id, deleted: true };
  }

  async run(auth: Auth, id: number, body: any = {}) {
    const automation = await this.raw(auth, id);
    const idempotencyKey = String(
      body.idempotencyKey || `manual:${id}:${randomUUID()}`,
    ).slice(0, 255);
    const existing = await this.runsModel.findOne({
      where: { organizationId: auth.organizationId, idempotencyKey },
    });
    if (existing) return this.presentRun(existing);
    const run = await this.runsModel.create({
      organizationId: auth.organizationId,
      automationId: automation.id,
      status: 'queued',
      input: { manual: true, requestedById: auth.id },
      output: {},
      actionResults: [],
      attemptCount: 0,
      maxAttempts: Number(automation.retryLimit || 3) + 1,
      availableAt: new Date(),
      idempotencyKey,
      triggerType: 'manual',
    });
    this.logger.log(`automation_run_queued runId=${run.id} automationId=${id}`);
    setImmediate(() => void this.tick());
    return this.presentRun(run);
  }

  async retryRun(auth: Auth, automationId: number, runId: number) {
    await this.raw(auth, automationId);
    const run = await this.runsModel.findOne({
      where: {
        id: runId,
        automationId,
        organizationId: auth.organizationId,
      },
    });
    if (!run) throw new NotFoundException('Automation run not found');
    if (run.status !== 'failed') {
      throw new UnprocessableEntityException('Only failed runs can be retried');
    }
    await run.update({
      status: 'queued',
      attemptCount: 0,
      availableAt: new Date(),
      lockedAt: null,
      startedAt: null,
      finishedAt: null,
      error: null,
      failureReason: null,
      actionResults: [],
      output: {},
    });
    setImmediate(() => void this.tick());
    return this.presentRun(run);
  }

  async runs(auth: Auth, id: number) {
    await this.raw(auth, id);
    const rows = await this.runsModel.findAll({
      where: { organizationId: auth.organizationId, automationId: id },
      order: [['createdAt', 'DESC']],
    });
    return rows.map((run) => this.presentRun(run));
  }

  async tick() {
    if (this.working) return;
    this.working = true;
    try {
      await this.enqueueSchedules();
      for (let index = 0; index < 10; index++) {
        const worked = await this.workOne();
        if (!worked) break;
      }
    } catch (error) {
      this.logger.error(
        `automation_worker_tick_failed error=${this.safeError(error)}`,
      );
    } finally {
      this.working = false;
    }
  }

  present(automation: Automation) {
    const value = automation.toJSON() as any;
    return { ...value, enabled: automation.isActive };
  }

  private async enqueueSchedules() {
    const due = await this.automations.findAll({
      where: { isActive: true, nextRunAt: { [Op.lte]: new Date() } },
      limit: 50,
      order: [['nextRunAt', 'ASC']],
    });
    for (const automation of due) {
      const scheduledAt = automation.nextRunAt || new Date();
      try {
        await this.runsModel.create({
          organizationId: automation.organizationId,
          automationId: automation.id,
          status: 'queued',
          input: { scheduledAt },
          output: {},
          actionResults: [],
          attemptCount: 0,
          maxAttempts: Number(automation.retryLimit || 3) + 1,
          availableAt: new Date(),
          idempotencyKey: `schedule:${automation.id}:${scheduledAt.toISOString()}`,
          triggerType: 'schedule',
        });
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
      }
      await automation.update({
        nextRunAt: this.nextRun(automation.trigger, scheduledAt),
      });
    }
  }

  private async workOne() {
    const run = await this.runsModel.findOne({
      where: {
        status: 'queued',
        [Op.or]: [
          { availableAt: null },
          { availableAt: { [Op.lte]: new Date() } },
        ],
      },
      order: [['availableAt', 'ASC']],
    });
    if (!run) return false;
    const [claimed] = await this.runsModel.update(
      {
        status: 'running',
        lockedAt: new Date(),
        startedAt: run.startedAt || new Date(),
        attemptCount: Number(run.attemptCount || 0) + 1,
      },
      { where: { id: run.id, status: 'queued' } },
    );
    if (!claimed) return true;
    await run.reload();
    const automation = await this.automations.findOne({
      where: { id: run.automationId, organizationId: run.organizationId },
    });
    if (!automation) {
      await run.update({
        status: 'failed',
        failureReason: 'Automation no longer exists',
        error: 'Automation no longer exists',
        finishedAt: new Date(),
      });
      return true;
    }

    try {
      const actionResults = await this.withTimeout(
        this.executeActions(automation),
        Number(automation.timeoutSeconds || 60) * 1_000,
      );
      await run.update({
        status: 'completed',
        output: {
          message: 'Automation completed',
          actionCount: actionResults.length,
        },
        actionResults,
        error: null,
        failureReason: null,
        lockedAt: null,
        finishedAt: new Date(),
      });
      await automation.update({ lastRunAt: new Date() });
      await this.audit(automation, run, 'completed');
      this.logger.log(`automation_run_completed runId=${run.id}`);
    } catch (error) {
      const reason = this.safeError(error);
      if (run.attemptCount < run.maxAttempts) {
        const delay = Math.min(60_000, 1_000 * 2 ** (run.attemptCount - 1));
        await run.update({
          status: 'queued',
          availableAt: new Date(Date.now() + delay),
          lockedAt: null,
          error: reason,
          failureReason: reason,
        });
        this.logger.warn(
          `automation_run_retry runId=${run.id} attempt=${run.attemptCount} delayMs=${delay}`,
        );
      } else {
        await run.update({
          status: 'failed',
          error: reason,
          failureReason: reason,
          lockedAt: null,
          finishedAt: new Date(),
        });
        await this.audit(automation, run, 'failed');
        this.logger.error(
          `automation_run_failed runId=${run.id} reason=${reason}`,
        );
      }
    }
    return true;
  }

  private async executeActions(automation: Automation) {
    const actions = Array.isArray(automation.actions)
      ? (automation.actions as AutomationAction[])
      : [];
    if (!actions.length) {
      throw new Error('Automation has no configured actions');
    }
    const results: object[] = [];
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];
      const type = String(action.type || '');
      const payload = action.payload || action;
      const base = {
        organizationId: automation.organizationId,
        projectId: automation.projectId,
      };
      let resource: any;
      if (type === 'create_task') {
        if (!payload.title) throw new Error('create_task requires title');
        resource = await this.tasks.create({
          ...base,
          createdById: automation.createdById,
          title: payload.title,
          description: payload.description,
          priority: payload.priority || 'medium',
          status: 'todo',
          dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
        });
      } else if (['generate_report', 'create_report'].includes(type)) {
        resource = await this.reports.create({
          ...base,
          createdById: automation.createdById,
          title: payload.title || automation.name,
          assistant: payload.assistant || 'executive',
          status: 'generated',
          content:
            payload.content ||
            `# ${payload.title || automation.name}\n\nGenerated by automation #${automation.id}.`,
          format: payload.format || 'markdown',
          metadata: { automationId: automation.id },
        });
      } else if (type === 'create_approval') {
        if (!payload.title || !payload.approvalType) {
          throw new Error('create_approval requires title and approvalType');
        }
        resource = await this.approvals.create({
          ...base,
          requestedByUserId: automation.createdById,
          title: payload.title,
          type: payload.approvalType,
          amount: payload.amount,
          currency: payload.currency || 'USD',
          description: payload.description,
          status: 'pending',
          metadata: { automationId: automation.id },
        });
      } else if (type === 'create_budget') {
        if (!payload.name || payload.amount === undefined) {
          throw new Error('create_budget requires name and amount');
        }
        resource = await this.budgets.create({
          ...base,
          name: payload.name,
          amount: payload.amount,
          currency: payload.currency || 'USD',
          periodStart: payload.periodStart
            ? new Date(payload.periodStart)
            : new Date(),
          periodEnd: payload.periodEnd
            ? new Date(payload.periodEnd)
            : new Date(),
          metadata: { automationId: automation.id },
        });
      } else if (type === 'create_crm_activity') {
        if (!payload.type || !payload.subject) {
          throw new Error('create_crm_activity requires type and subject');
        }
        resource = await this.activities.create({
          organizationId: automation.organizationId,
          userId: automation.createdById,
          contactId: payload.contactId,
          companyId: payload.companyId,
          dealId: payload.dealId,
          type: payload.type,
          subject: payload.subject,
          body: payload.body,
          occurredAt: payload.occurredAt
            ? new Date(payload.occurredAt)
            : new Date(),
          metadata: { automationId: automation.id },
        });
      } else {
        throw new Error(
          `Unsupported automation action: ${type || 'missing type'}`,
        );
      }
      results.push({
        index,
        type,
        status: 'completed',
        resource: {
          type: resource.constructor?.name || 'record',
          id: resource.id,
        },
      });
    }
    return results;
  }

  private async raw(auth: Auth, id: number) {
    const automation = await this.automations.findOne({
      where: { id, organizationId: auth.organizationId },
    });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }

  private async project(auth: Auth, id?: number) {
    if (
      id &&
      !(await this.projects.findOne({
        where: { id, organizationId: auth.organizationId },
      }))
    ) {
      throw new NotFoundException('Project not found in your organization');
    }
  }

  private presentRun(run: AutomationRun) {
    return {
      id: run.id,
      automationId: run.automationId,
      status: run.status,
      attemptCount: run.attemptCount,
      maxAttempts: run.maxAttempts,
      availableAt: run.availableAt || null,
      startedAt: run.startedAt || null,
      finishedAt: run.finishedAt || null,
      output: run.output || {},
      actionResults: run.actionResults || [],
      failureReason: run.failureReason || null,
      triggerType: run.triggerType || null,
      idempotencyKey: run.idempotencyKey || null,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  private nextRun(trigger: any, currentDate = new Date()) {
    if (trigger?.cron) {
      return CronExpressionParser.parse(String(trigger.cron), {
        currentDate,
        tz: trigger.timezone || 'UTC',
      })
        .next()
        .toDate();
    }
    const minutes = Number(trigger?.intervalMinutes || 0);
    if (minutes > 0) return new Date(currentDate.getTime() + minutes * 60_000);
    throw new UnprocessableEntityException(
      'Scheduled automation requires trigger.cron or trigger.intervalMinutes',
    );
  }

  private integer(value: any, fallback: number, min: number, max: number) {
    const parsed = Number(value ?? fallback);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new UnprocessableEntityException(`Value must be ${min}-${max}`);
    }
    return parsed;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Automation execution timed out')),
          timeoutMs,
        ),
      ),
    ]);
  }

  private async audit(
    automation: Automation,
    run: AutomationRun,
    status: 'completed' | 'failed',
  ) {
    await this.audits.create({
      organizationId: automation.organizationId,
      actorId: automation.createdById,
      action: `automation.run.${status}`,
      entityType: 'automation_run',
      entityId: run.id,
      after: {
        status,
        attemptCount: run.attemptCount,
        actionResults: run.actionResults,
      },
      metadata: { automationId: automation.id, triggerType: run.triggerType },
    });
  }

  private safeError(error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Automation failed';
    return message.replace(/[\r\n]/g, ' ').slice(0, 500);
  }
}
