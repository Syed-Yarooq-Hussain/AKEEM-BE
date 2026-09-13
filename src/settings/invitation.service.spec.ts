import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

function serviceWith(invitation: any, options: any = {}) {
  const organization = Object.prototype.hasOwnProperty.call(
    options,
    'organization',
  )
    ? options.organization
    : { id: 10 };
  const role = Object.prototype.hasOwnProperty.call(options, 'role')
    ? options.role
    : { id: 2 };
  return new SettingsService(
    {
      findByPk: jest.fn().mockResolvedValue(organization),
    } as any,
    {} as any,
    { findOne: jest.fn().mockResolvedValue(invitation) } as any,
    {
      findOne: jest.fn().mockResolvedValue(role),
    } as any,
    { findOne: jest.fn().mockResolvedValue(null) } as any,
    {} as any,
    {} as any,
  );
}

describe('invitation validation', () => {
  const token = 'a'.repeat(64);
  const active = {
    id: 1,
    organizationId: 10,
    roleId: 2,
    email: 'member@example.com',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
  };

  it('rejects invalid tokens', async () => {
    await expect(
      serviceWith(null).inspectInvitation(token),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });
  });

  it('rejects expired tokens', async () => {
    await expect(
      serviceWith({
        ...active,
        expiresAt: new Date(Date.now() - 1),
      }).inspectInvitation(token),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_EXPIRED' }),
    });
  });

  it.each([
    { status: 'accepted', acceptedAt: new Date(), revokedAt: null },
    { status: 'revoked', acceptedAt: null, revokedAt: new Date() },
  ])('rejects reused or revoked invitations', async (state) => {
    await expect(
      serviceWith({ ...active, ...state }).inspectInvitation(token),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a role that does not belong to the invitation organization', async () => {
    await expect(
      serviceWith(active, { role: null }).inspectInvitation(token),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITATION_INVALID' }),
    });
  });
});
