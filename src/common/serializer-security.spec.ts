import { AdminService } from '../admin/admin.service';
import { CredentialEncryptionService } from '../admin/credential-encryption.service';
import { SettingsService } from '../settings/settings.service';

const auth = { id: 1, organizationId: 10, role: 'owner' };
const membership = {
  id: 5,
  organizationId: 10,
  userId: 1,
  roleId: 2,
  status: 'active',
  jobTitle: null,
  invitedAt: null,
  joinedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  toJSON: () => ({
    user: {
      id: 1,
      firstName: 'QA',
      lastName: 'Owner',
      email: 'qa@example.com',
      passwordHash: 'must-never-leak',
      preferences: {},
    },
    role: { id: 2, name: 'Owner', description: 'Owner', isSystem: true },
  }),
};

describe('user response security', () => {
  it('removes password hashes from organization member responses', async () => {
    const service = new SettingsService(
      {} as any,
      { findAll: jest.fn().mockResolvedValue([membership]) } as any,
      {} as any,
      {} as any,
      {} as any,
      { sendInvitation: jest.fn() } as any,
      {} as any,
    );

    const result = await service.members(auth);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('must-never-leak');
  });

  it('removes password hashes from admin user responses', async () => {
    const service = new AdminService(
      { findAll: jest.fn().mockResolvedValue([membership]) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as CredentialEncryptionService,
    );

    const result = await service.users(auth);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('must-never-leak');
  });

  it('returns an empty audit-log page instead of failing', async () => {
    const service = new AdminService(
      {} as any,
      {} as any,
      {} as any,
      {
        findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
      } as any,
      {} as any,
      {} as CredentialEncryptionService,
    );

    await expect(service.logs(auth, { page: 1, limit: 20 })).resolves.toEqual({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
