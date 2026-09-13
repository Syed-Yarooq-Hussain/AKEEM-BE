import { Op } from 'sequelize';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';

describe('KnowledgeRetrievalService isolation', () => {
  it('always applies tenant and selected-project scope and returns citations', async () => {
    const chunks = {
      findAll: jest.fn().mockResolvedValue([
        {
          fileId: 9,
          projectId: 4,
          content: 'Project margin is 42 percent',
          reference: 'page 2',
        },
      ]),
    };
    const files = {
      findAll: jest
        .fn()
        .mockResolvedValue([{ id: 9, originalName: 'finance.pdf' }]),
    };
    const service = new KnowledgeRetrievalService(chunks as any, files as any);

    const result = await service.context(10, 4, 'margin');
    const where = chunks.findAll.mock.calls[0][0].where;
    expect(where.organizationId).toBe(10);
    expect(where[Op.or]).toEqual([{ projectId: 4 }, { projectId: null }]);
    expect(files.findAll.mock.calls[0][0].where.organizationId).toBe(10);
    expect(result.citations).toEqual([
      { fileId: 9, filename: 'finance.pdf', reference: 'page 2' },
    ]);
    expect(result.text).toContain('UNTRUSTED DOCUMENT EXCERPTS');
  });
});
