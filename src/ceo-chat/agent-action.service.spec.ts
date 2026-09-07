import { AiAgent } from '../../models';
import { AgentActionService } from './agent-action.service';

describe('AgentActionService', () => {
  const unused = {} as any;
  const service = new AgentActionService(
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
  );
  const auth = { id: 2, organizationId: 9 };
  const agent = { id: 4, name: 'Finance AI' } as AiAgent;

  it('previews an allowlisted action without writing in suggest mode', async () => {
    const result = await service.execute(
      auth,
      null,
      agent,
      'finance',
      [
        {
          type: 'create_budget',
          payload: JSON.stringify({ name: 'Q4 plan', amount: 1000 }),
          reason: 'Plan the quarter',
        },
      ],
      'suggest',
    );

    expect(result).toEqual([
      expect.objectContaining({
        type: 'create_budget',
        status: 'proposed',
        data: { name: 'Q4 plan', amount: 1000 },
      }),
    ]);
  });

  it('rejects malformed model payloads as a failed action', async () => {
    const result = await service.execute(
      auth,
      null,
      agent,
      'finance',
      [
        {
          type: 'create_budget',
          payload: '{not-json',
          reason: 'Invalid request',
        },
      ],
      'suggest',
    );

    expect(result[0].status).toBe('failed');
    expect(result[0].error).toMatch(/valid JSON object/i);
  });

  it('enforces the server-side action allowlist', async () => {
    const result = await service.execute(
      auth,
      null,
      agent,
      'finance',
      [
        {
          type: 'create_crm_activity',
          payload: '{}',
          reason: 'Not a finance capability',
        },
      ],
      'suggest',
    );

    expect(result[0].status).toBe('failed');
    expect(result[0].error).toMatch(/not allowed/i);
  });
});
