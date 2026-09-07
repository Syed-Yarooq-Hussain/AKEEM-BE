import { CeoChatService } from './ceo-chat.service';

describe('CeoChatService routing guards', () => {
  const service = Object.create(CeoChatService.prototype) as any;

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
});
