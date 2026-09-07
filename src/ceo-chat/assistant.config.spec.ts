import {
  ASSISTANTS,
  ASSISTANT_DEFINITIONS,
  isAssistant,
  modelForAssistant,
  publicAssistantDirectory,
} from './assistant.config';

describe('assistant configuration', () => {
  const originalModel = process.env.OPENAI_MODEL;
  const originalFinanceModel = process.env.OPENAI_FINANCE_MODEL;

  afterEach(() => {
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    if (originalFinanceModel === undefined)
      delete process.env.OPENAI_FINANCE_MODEL;
    else process.env.OPENAI_FINANCE_MODEL = originalFinanceModel;
  });

  it('has a complete definition and at least one safe action for every assistant', () => {
    expect(ASSISTANTS).toHaveLength(8);
    for (const assistant of ASSISTANTS) {
      expect(ASSISTANT_DEFINITIONS[assistant].description).toBeTruthy();
      expect(ASSISTANT_DEFINITIONS[assistant].actions.length).toBeGreaterThan(
        0,
      );
      expect(isAssistant(assistant)).toBe(true);
    }
    expect(isAssistant('random-agent')).toBe(false);
  });

  it('allows each specialist to use its own configured model', () => {
    process.env.OPENAI_MODEL = 'default-model';
    process.env.OPENAI_FINANCE_MODEL = 'finance-model';
    expect(modelForAssistant('finance')).toBe('finance-model');
    expect(modelForAssistant('sales')).toBe('default-model');
  });

  it('returns a frontend-ready assistant directory', () => {
    const directory = publicAssistantDirectory();
    expect(directory.map((item) => item.key)).toEqual([...ASSISTANTS]);
    expect(
      directory.every(
        (item) => item.model && item.capabilities.length && item.actions.length,
      ),
    ).toBe(true);
  });
});
