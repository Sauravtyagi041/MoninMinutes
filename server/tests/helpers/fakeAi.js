import http from 'node:http';

export const FAKE_AI_PORT = 45871;

/** Minimal OpenAI-compatible server so tests exercise the real provider code over HTTP. */
export function startFakeAi() {
  const state = {
    calls: [],
    // (body) => ({status?, content?: object|string})
    respond: null,
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      state.calls.push({ url: req.url, auth: req.headers.authorization, body });
      const out = (state.respond ?? defaultResponse)(body, state.calls.length);
      res.statusCode = out.status ?? 200;
      res.setHeader('content-type', 'application/json');
      if ((out.status ?? 200) >= 400) return res.end(JSON.stringify({ error: { message: 'boom' } }));
      const content = typeof out.content === 'string' ? out.content : JSON.stringify(out.content);
      res.end(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      );
    });
  });
  return {
    state,
    listen: () => new Promise((r) => server.listen(FAKE_AI_PORT, '127.0.0.1', r)),
    close: () => new Promise((r) => server.close(r)),
    reset() {
      state.calls = [];
      state.respond = null;
    },
  };
}

export const userText = (body) => body.messages.find((m) => m.role === 'user').content;

// Valid minutes for the sample transcript in tests/fixtures.
export const sampleExtraction = (overrides = {}) => ({
  overview: 'The team reviewed sprint progress and agreed to ship the API on Friday.',
  key_points: [{ text: 'Authentication API is ready for testing.', segment_ids: [1] }],
  decisions: [{ text: 'The team agreed to use PostgreSQL.', segment_ids: [3], owner: null }],
  action_items: [
    {
      task: 'Finish the API documentation',
      assignee: 'Priya',
      due_date: null,
      due_date_text: 'by Friday',
      priority: 'high',
      evidence: 'Priya, please finish the API documentation by Friday.',
      segment_ids: [2],
      confidence: 0.94,
    },
    {
      task: 'Update the onboarding docs',
      assignee: null,
      due_date: null,
      due_date_text: null,
      priority: 'medium',
      evidence: 'Someone should update the onboarding docs.',
      segment_ids: [4],
      confidence: 0.6,
    },
  ],
  risks: [{ text: 'Staging environment is unstable.', segment_ids: [5] }],
  open_questions: [{ text: 'Who will own the mobile release?', segment_ids: [6] }],
  ...overrides,
});

function defaultResponse() {
  return { content: sampleExtraction() };
}
