import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import {
  Organization,
  User,
  Project,
  Budget,
  Invoice,
  Expense,
  Transaction,
  Task,
} from '../models';

jest.setTimeout(60000);

describe('Project demo API', () => {
  let app: INestApplication;
  let owner: any;
  beforeAll(async () => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Integration fixtures must not run in production');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    owner = await module.get(AuthService).signup({
      firstName: 'Demo',
      lastName: 'Test',
      email: `demo-seed-${Date.now()}@example.invalid`,
      password: 'TestPassword123!',
      organizationName: 'Disposable demo seed test',
      timezone: 'Europe/Berlin',
      currency: 'EUR',
    });
  });
  afterAll(async () => {
    if (owner) {
      await Organization.destroy({
        where: { id: owner.organization.id },
        force: true,
      });
      await User.destroy({ where: { id: owner.user.id }, force: true });
    }
    await app?.close();
  });
  it('seeds once under concurrent requests with linked and balanced data', async () => {
    const project = await Project.create({
      organizationId: owner.organization.id,
      ownerId: owner.user.id,
      name: 'Seed test',
      status: 'active',
      settings: { retained: true },
    });
    const url = `/api/projects/${project.id}/demo-data`;
    const invoke = () => request(app.getHttpServer()).post(url).expect(201);
    const responses = await Promise.all([invoke(), invoke()]);
    expect(responses.map((r) => r.body.data.alreadySeeded).sort()).toEqual([
      false,
      true,
    ]);
    const where = {
      projectId: project.id,
      organizationId: owner.organization.id,
    };
    expect(await Budget.count({ where })).toBe(1);
    expect(await Invoice.count({ where })).toBe(2);
    expect(await Expense.count({ where })).toBe(3);
    expect(await Transaction.count({ where })).toBe(4);
    expect(await Task.count({ where })).toBe(8);
    expect(Number(await Expense.sum('amount', { where }))).toBe(11000);
    await project.reload();
    expect(project.companyId).toBeTruthy();
    expect(project.contactId).toBeTruthy();
    expect(project.dealId).toBeTruthy();
    expect((project.settings as any).retained).toBe(true);
    expect((project.settings as any).demoDataSeed.scenario.cashBalance).toBe(
      4000,
    );
  });

  it('allows another project without a token or env setting and keeps project reads protected', async () => {
    const project = await Project.create({
      organizationId: owner.organization.id,
      ownerId: owner.user.id,
      name: 'Public seed test',
      status: 'active',
      settings: {},
    });
    const url = `/api/demo/projects/${project.id}/data`;
    await request(app.getHttpServer())
      .post('/api/projects/2147483647/demo-data')
      .expect(404);
    const response = await request(app.getHttpServer())
      .post(url)
      .send({ projectId: project.id + 1, organizationId: 999999 })
      .expect(201);
    expect(response.body.data.projectId).toBe(project.id);
    expect(response.body.data.alreadySeeded).toBe(false);
    expect(Object.keys(response.body.data).sort()).toEqual([
      'alreadySeeded',
      'message',
      'projectId',
    ]);
    expect(await Budget.count({ where: { projectId: project.id } })).toBe(1);
    await request(app.getHttpServer())
      .get(`/api/projects/${project.id}`)
      .expect(401);
  });
});
