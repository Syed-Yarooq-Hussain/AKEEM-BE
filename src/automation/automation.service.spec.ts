import { AutomationService } from './automation.service';

describe('AutomationService durability contracts', () => {
  it('returns the existing run for a repeated idempotency key', async () => {
    const automation = { id: 3, organizationId: 10 };
    const existing = {
      id: 8,
      automationId: 3,
      status: 'queued',
      idempotencyKey: 'same-key',
      attemptCount: 0,
      maxAttempts: 4,
      availableAt: new Date(),
      toJSON() {
        return { ...this };
      },
    };
    const runs = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
    };
    const service = new AutomationService(
      { findOne: jest.fn().mockResolvedValue(automation) } as any,
      runs as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.run({ id: 1, organizationId: 10 }, 3, {
      idempotencyKey: 'same-key',
    });
    expect(result).toMatchObject({ id: 8, status: 'queued' });
    expect(runs.create).not.toHaveBeenCalled();
  });

  it('recovers running jobs to queued state on startup', async () => {
    const prior = process.env.AUTOMATION_WORKER_ENABLED;
    process.env.AUTOMATION_WORKER_ENABLED = 'false';
    const runs = { update: jest.fn().mockResolvedValue([2]) };
    const service = new AutomationService(
      {} as any,
      runs as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await service.onModuleInit();
    expect(runs.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued', lockedAt: null }),
      { where: { status: 'running' } },
    );
    if (prior === undefined) delete process.env.AUTOMATION_WORKER_ENABLED;
    else process.env.AUTOMATION_WORKER_ENABLED = prior;
  });
});
