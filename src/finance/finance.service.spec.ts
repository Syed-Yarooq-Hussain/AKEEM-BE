import { NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';

function build(projectExists = true) {
  const invoice = {
    sum: jest.fn().mockResolvedValue(100),
    findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
  };
  const expense = { sum: jest.fn().mockResolvedValue(25) };
  const transaction = {
    findAll: jest.fn().mockResolvedValue([{ type: 'income', amount: 80 }]),
    findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
  };
  const service = new FinanceService(
    { findAll: jest.fn().mockResolvedValue([]) } as any,
    expense as any,
    {} as any,
    invoice as any,
    {} as any,
    { findByPk: jest.fn().mockResolvedValue({ currency: 'USD' }) } as any,
    {
      findOne: jest.fn().mockResolvedValue(projectExists ? { id: 4 } : null),
    } as any,
    transaction as any,
  );
  return { service, invoice, expense, transaction };
}

describe('FinanceService project and tenant scoping', () => {
  it('uses the same organization/project scope for overview totals', async () => {
    const { service, invoice, expense, transaction } = build();
    await service.overview({ organizationId: 10 }, 4);
    expect(invoice.sum.mock.calls[0][1].where).toEqual({
      organizationId: 10,
      projectId: 4,
    });
    expect(expense.sum.mock.calls[0][1].where).toMatchObject({
      organizationId: 10,
      projectId: 4,
    });
    expect(transaction.findAll.mock.calls[0][0].where).toMatchObject({
      organizationId: 10,
      projectId: 4,
    });
  });

  it('rejects a project outside the authenticated organization', async () => {
    const { service } = build(false);
    await expect(
      service.transactions({ organizationId: 10 }, { projectId: 999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
