import { ProjectDemoService } from './project-demo.service';
import { Project } from '../../models';

describe('Project demo seed guards', () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  const database = { transaction: jest.fn((callback) => callback(tx)) };
  const service = new ProjectDemoService(database as any);
  afterEach(() => jest.restoreAllMocks());

  it('rejects non-admin users before accessing data', async () => {
    database.transaction.mockClear();
    await expect(
      service.seed({ id: 1, organizationId: 2, role: 'Member' }, 3),
    ).rejects.toMatchObject({ status: 403 });
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('locks only the authenticated organization project', async () => {
    const find = jest.spyOn(Project, 'findOne').mockResolvedValue(null);
    await expect(
      service.seed({ id: 1, organizationId: 2, role: 'Owner' }, 3),
    ).rejects.toMatchObject({ status: 404 });
    expect(find).toHaveBeenCalledWith({
      where: { id: 3, organizationId: 2 },
      transaction: tx,
      lock: 'UPDATE',
    });
  });

  it('returns existing seed metadata without writing more data', async () => {
    const seed = { projectId: 3, ids: { budgets: [7] }, alreadySeeded: false };
    jest
      .spyOn(Project, 'findOne')
      .mockResolvedValue({ settings: { demoDataSeed: seed } } as any);
    await expect(
      service.seed({ id: 1, organizationId: 2, role: 'Admin' }, 3),
    ).resolves.toEqual({ ...seed, alreadySeeded: true });
  });
});
