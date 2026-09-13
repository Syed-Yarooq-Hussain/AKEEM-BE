import { CeoChatService } from './ceo-chat.service';

describe('CeoChatService routing guards', () => {
  const service = Object.create(CeoChatService.prototype) as any;

  it('returns a retryable API error when every specialist fails', async () => {
    const failed = Object.create(CeoChatService.prototype) as any;
    Object.assign(failed, {
      client: {},
      optionalProject: jest.fn().mockResolvedValue(null),
      getOrCreateAgent: jest.fn().mockResolvedValue({ id: 1 }),
      ensureAgentTeam: jest.fn(),
      getConversation: jest.fn().mockResolvedValue({ id: 1 }),
      messages: { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() },
      buildBusinessContext: jest
        .fn()
        .mockResolvedValue({ text: '', citations: [] }),
      executeDelegation: jest.fn().mockResolvedValue({
        id: 1,
        assistant: 'sales',
        status: 'failed',
        answer: '',
        actions: [],
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
    });
    await expect(
      failed.chat(
        { id: 1, organizationId: 1 },
        {
          assistant: 'sales',
          message: 'Review sales',
          executionMode: 'suggest',
        },
      ),
    ).rejects.toMatchObject({
      status: 502,
      response: { code: 'AI_PROVIDER_ERROR' },
    });
    expect(failed.messages.create).toHaveBeenCalledTimes(1);
  });

  it('deduplicates delegations and rejects self, CEO, and unknown agents', () => {
    const result = service.normalizeDelegations(
      [
        { assistant: 'finance', objective: 'Review cash flow' },
        { assistant: 'finance', objective: 'Do it again' },
        { assistant: 'ceo', objective: 'Loop back' },
        { assistant: 'executive', objective: 'Self delegation' },
        { assistant: 'unknown', objective: 'Invalid' },
        { assistant: 'operations', objective: 'Plan delivery' },
      ],
      'executive',
    );

    expect(result).toEqual([
      { assistant: 'finance', objective: 'Review cash flow' },
      { assistant: 'operations', objective: 'Plan delivery' },
    ]);
  });

  it('drops specialist actions that are not on the global action registry', () => {
    const result = service.parseSpecialistResult(
      JSON.stringify({
        inScope: true,
        answer: 'Done',
        actions: [
          { type: 'create_task', payload: '{}', reason: 'Allowed' },
          { type: 'run_shell', payload: '{}', reason: 'Forbidden' },
        ],
      }),
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('create_task');
  });

  it('adds executed resource IDs to direct specialist answers', () => {
    const result = service.withActionSummary('Created the requested plan.', [
      {
        type: 'create_budget',
        status: 'executed',
        reason: 'Requested by user',
        resource: { type: 'budget', id: 12 },
      },
    ]);

    expect(result).toContain('budget #12');
  });

  it('returns a safe 503 when the AI provider is not configured', async () => {
    const unconfigured = Object.create(CeoChatService.prototype) as any;
    unconfigured.client = undefined;

    try {
      await unconfigured.chat(
        { id: 1, organizationId: 1 },
        { message: 'Summarize this project' },
        'ceo',
      );
      throw new Error('Expected chat to reject');
    } catch (error) {
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        message: 'AI service is not configured',
        code: 'AI_PROVIDER_NOT_CONFIGURED',
      });
    }
  });

  it('clears provider timeout timers after a successful request', async () => {
    jest.useFakeTimers();
    try {
      await expect(service.providerRequest(async () => 'ok')).resolves.toBe(
        'ok',
      );
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry permanent provider errors or retain their timers', async () => {
    jest.useFakeTimers();
    const error = Object.assign(new Error('Invalid request'), { status: 400 });
    const operation = jest.fn().mockRejectedValue(error);
    try {
      await expect(service.providerRequest(operation)).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns child results before finishing parent actions and propagates suggest mode', async () => {
    const delegated = Object.create(CeoChatService.prototype) as any;
    delegated.getOrCreateAgent = jest.fn(async (_auth, assistant) => ({
      id: 1,
      name: `${assistant} AI`,
    }));
    delegated.ensureAgentTeam = jest.fn();
    let nextId = 0;
    delegated.delegations = {
      create: jest.fn(async () => ({ id: ++nextId, update: jest.fn() })),
    };
    const result = (answer, delegations = []) => ({
      inScope: true,
      answer,
      delegations,
      actions: [],
      model: 'test',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    delegated.callSpecialist = jest
      .fn()
      .mockResolvedValueOnce(
        result('Need finance', [
          { assistant: 'finance', objective: 'Check budget' },
        ]),
      )
      .mockResolvedValueOnce(result('Budget checked'))
      .mockResolvedValueOnce(result('Final sales answer'));
    delegated.actionService = { execute: jest.fn().mockResolvedValue([]) };
    const response = await delegated.executeDelegation(
      { id: 1, organizationId: 1 },
      null,
      { id: 1 },
      { id: 1, name: 'Sales AI' },
      { assistant: 'sales', objective: 'Plan sale' },
      'Plan sale',
      '',
      'suggest',
    );
    expect(response.children).toHaveLength(1);
    expect(response.children[0].parentDelegationId).toBe(response.id);
    expect(delegated.callSpecialist.mock.calls[2][1]).toContain(
      'Budget checked',
    );
    expect(delegated.callSpecialist.mock.calls[2][5]).toEqual([]);
    expect(
      delegated.actionService.execute.mock.calls.map((call) => [
        call[3],
        call[5],
      ]),
    ).toEqual([
      ['finance', 'suggest'],
      ['sales', 'suggest'],
    ]);
  });
});
