import { ForbiddenException } from '@nestjs/common';
import { ApprovalService } from './approval.service';

function build(role: string, requesterId = 99) {
  const approval: any = {
    id: 7,
    status: 'pending',
    requestedByUserId: requesterId,
    reviewedAt: null,
    update: jest.fn(async (values) => Object.assign(approval, values)),
    toJSON: () => ({ id: approval.id, status: approval.status }),
  };
  const audits = { create: jest.fn().mockResolvedValue({}) };
  const service = new ApprovalService(
    { findOne: jest.fn().mockResolvedValue(approval) } as any,
    {} as any,
    { findByPk: jest.fn().mockResolvedValue(null) } as any,
    {} as any,
    {
      findOne: jest.fn().mockResolvedValue({ role: { name: role } }),
    } as any,
    audits as any,
  );
  return { service, approval, audits };
}

describe('ApprovalService RBAC', () => {
  it.each(['Owner', 'Admin', 'Approver'])(
    'allows an active %s reviewer and audits the decision',
    async (role) => {
      const { service, audits } = build(role);
      await expect(
        service.review({ id: 1, organizationId: 10 }, 7, 'approved', 'OK'),
      ).resolves.toMatchObject({ status: 'approved' });
      expect(audits.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 10,
          actorId: 1,
          action: 'approval.approved',
        }),
      );
    },
  );

  it('rejects a normal member', async () => {
    const { service } = build('Member');
    await expect(
      service.review({ id: 1, organizationId: 10 }, 7, 'rejected'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents requester self-approval', async () => {
    const { service } = build('Owner', 1);
    await expect(
      service.review({ id: 1, organizationId: 10 }, 7, 'approved'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
