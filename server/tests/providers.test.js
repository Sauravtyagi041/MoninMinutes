import { describe, expect, it } from 'vitest';
import { anthropicProvider, createProvider, openAiProvider, withRetries } from '../src/services/ai/providers.js';
import { AiError } from '../src/services/ai/errors.js';

const jsonRes = (status, body) => ({ ok: status < 400, status, json: async () => body });
const schema = { type: 'object' };

describe('providers', () => {
  it('openai: sends json_schema response_format and parses content + usage', async () => {
    let sent;
    const p = openAiProvider({
      apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', timeoutMs: 1000,
      fetchImpl: async (url, init) => {
        sent = { url, init, body: JSON.parse(init.body) };
        return jsonRes(200, { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 3, completion_tokens: 4 } });
      },
    });
    const r = await p.complete({ system: 'S', user: 'U', schema, schemaName: 'x' });
    expect(r).toEqual({ json: { a: 1 }, usage: { prompt: 3, completion: 4 } });
    expect(sent.url).toBe('https://x/v1/chat/completions');
    expect(sent.init.headers.authorization).toBe('Bearer k');
    expect(sent.body.response_format.json_schema.strict).toBe(true);
    expect(sent.body.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('anthropic: forces a tool call and reads tool_use input', async () => {
    let body;
    const p = anthropicProvider({
      apiKey: 'k', model: 'm', baseUrl: 'https://a', timeoutMs: 1000,
      fetchImpl: async (_u, init) => {
        body = JSON.parse(init.body);
        return jsonRes(200, { content: [{ type: 'tool_use', input: { a: 2 } }], usage: { input_tokens: 5, output_tokens: 6 } });
      },
    });
    const r = await p.complete({ system: 'S', user: 'U', schema, schemaName: 'tool1' });
    expect(r).toEqual({ json: { a: 2 }, usage: { prompt: 5, completion: 6 } });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'tool1' });
    expect(body.system).toBe('S');
  });

  it.each([
    [401, 'AI_AUTH', false],
    [429, 'AI_RATE_LIMIT', true],
    [503, 'AI_UNAVAILABLE', true],
  ])('maps HTTP %i to %s', async (status, code, retryable) => {
    const p = openAiProvider({ model: 'm', baseUrl: 'https://x', timeoutMs: 1000, fetchImpl: async () => jsonRes(status, {}) });
    await expect(p.complete({ system: '', user: '', schema, schemaName: 'x' })).rejects.toMatchObject({ code, retryable });
  });

  it('maps network failures to AI_UNAVAILABLE without leaking details', async () => {
    const p = openAiProvider({ model: 'm', baseUrl: 'https://x', timeoutMs: 1000, fetchImpl: async () => { throw new Error('secret-host:443 refused'); } });
    const err = await p.complete({ system: '', user: '', schema, schemaName: 'x' }).catch((e) => e);
    expect(err.code).toBe('AI_UNAVAILABLE');
    expect(err.userMessage).not.toMatch(/secret-host/);
  });

  it('reports malformed JSON as retryable bad output', async () => {
    const p = openAiProvider({ model: 'm', baseUrl: 'https://x', timeoutMs: 1000, fetchImpl: async () => jsonRes(200, { choices: [{ message: { content: 'not json' } }] }) });
    await expect(p.complete({ system: '', user: '', schema, schemaName: 'x' })).rejects.toMatchObject({ code: 'AI_BAD_OUTPUT' });
  });

  it('withRetries retries only retryable errors', async () => {
    let n = 0;
    const r = await withRetries(async () => { n += 1; if (n < 3) throw new AiError('AI_UNAVAILABLE', 'x', { retryable: true }); return 'done'; }, { retries: 2, baseDelayMs: 1 });
    expect(r).toBe('done');
    let m = 0;
    await expect(withRetries(async () => { m += 1; throw new AiError('AI_AUTH', 'x'); }, { retries: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(m).toBe(1);
  });

  it('createProvider reports missing configuration clearly', () => {
    expect(() => createProvider({ provider: 'openai', apiKey: '', model: 'm' })).toThrow(/AI_API_KEY/);
    expect(() => createProvider({ provider: 'openai', apiKey: 'k', model: '' })).toThrow(/AI_MODEL/);
    expect(() => createProvider({ provider: 'openai-compatible', model: 'm', baseUrl: '' })).toThrow(/AI_BASE_URL/);
  });
});
