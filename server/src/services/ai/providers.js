import { env } from '../../config/env.js';
import { AiError } from './errors.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const classifyStatus = (status) => {
  if (status === 401 || status === 403)
    return new AiError('AI_AUTH', 'The AI provider rejected the configured credentials. Check AI_API_KEY.');
  if (status === 429)
    return new AiError('AI_RATE_LIMIT', 'The AI provider is rate-limiting requests. Please retry in a minute.', { retryable: true });
  if (status >= 500)
    return new AiError('AI_UNAVAILABLE', 'The AI provider is temporarily unavailable. Please retry shortly.', { retryable: true });
  return new AiError('AI_UNAVAILABLE', `The AI provider rejected the request (HTTP ${status}).`);
};

async function post(url, headers, body, { timeoutMs, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new AiError(
      'AI_UNAVAILABLE',
      timedOut ? 'The AI provider took too long to respond.' : 'Could not reach the AI provider.',
      { retryable: true, cause: e },
    );
  }
  if (!res.ok) throw classifyStatus(res.status);
  try {
    return await res.json();
  } catch (e) {
    throw new AiError('AI_BAD_OUTPUT', 'The AI provider returned an unreadable response.', { retryable: true, cause: e });
  }
}

const parseJsonText = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    // Some compatible servers wrap JSON in a code fence.
    const m = String(s).match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
    throw new Error('not json');
  }
};

/** OpenAI chat-completions with strict JSON-schema output (also used for compatible servers). */
export const openAiProvider = ({ apiKey, model, baseUrl, timeoutMs, fetchImpl }) => ({
  name: 'openai',
  model,
  async complete({ system, user, schema, schemaName }) {
    const data = await post(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
      },
      { timeoutMs, fetchImpl },
    );
    const msg = data?.choices?.[0]?.message;
    if (msg?.refusal) throw new AiError('AI_BAD_OUTPUT', 'The AI model declined to process this transcript.');
    let json;
    try {
      json = parseJsonText(msg?.content ?? '');
    } catch (e) {
      throw new AiError('AI_BAD_OUTPUT', 'The AI returned malformed JSON.', { retryable: true, cause: e });
    }
    return {
      json,
      usage: { prompt: data.usage?.prompt_tokens ?? 0, completion: data.usage?.completion_tokens ?? 0 },
    };
  },
});

/** Anthropic Messages API, forcing a single tool call whose input is the structured result. */
export const anthropicProvider = ({ apiKey, model, baseUrl, timeoutMs, fetchImpl }) => ({
  name: 'anthropic',
  model,
  async complete({ system, user, schema, schemaName }) {
    const data = await post(
      `${baseUrl.replace(/\/$/, '')}/v1/messages`,
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }],
        tools: [{ name: schemaName, description: 'Record the structured result.', input_schema: schema }],
        tool_choice: { type: 'tool', name: schemaName },
      },
      { timeoutMs, fetchImpl },
    );
    const block = data?.content?.find((b) => b.type === 'tool_use');
    if (!block || typeof block.input !== 'object') {
      throw new AiError('AI_BAD_OUTPUT', 'The AI returned no structured result.', { retryable: true });
    }
    return {
      json: block.input,
      usage: { prompt: data.usage?.input_tokens ?? 0, completion: data.usage?.output_tokens ?? 0 },
    };
  },
});

export const createProvider = (overrides = {}) => {
  const cfg = {
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    baseUrl: env.AI_BASE_URL,
    timeoutMs: env.AI_TIMEOUT_MS,
    ...overrides,
  };
  const missing = [];
  if (!cfg.model) missing.push('AI_MODEL');
  if (!cfg.apiKey && cfg.provider !== 'openai-compatible') missing.push('AI_API_KEY');
  if (cfg.provider === 'openai-compatible' && !cfg.baseUrl) missing.push('AI_BASE_URL');
  if (missing.length) {
    throw new AiError(
      'AI_CONFIG',
      `AI processing is not configured on this server (missing ${missing.join(', ')}). Your transcript is saved; ask the administrator to set these and retry.`,
    );
  }
  if (cfg.provider === 'anthropic') {
    return anthropicProvider({ ...cfg, baseUrl: cfg.baseUrl || 'https://api.anthropic.com' });
  }
  return openAiProvider({ ...cfg, baseUrl: cfg.baseUrl || 'https://api.openai.com/v1' });
};

export const isAiConfigured = () => {
  try {
    createProvider();
    return true;
  } catch {
    return false;
  }
};

/** Retries transient failures (rate limit, 5xx, network) with exponential backoff. */
export async function withRetries(fn, { retries = env.AI_MAX_RETRIES, baseDelayMs = 800 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof AiError) || !e.retryable || attempt >= retries) throw e;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}
