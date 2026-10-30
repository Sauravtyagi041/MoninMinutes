// DEV/TEST ONLY: an OpenAI-compatible stub that returns a fixed, schema-valid response.
// Use it to click through the UI without an API key:
//   node scripts/stub-ai.js   (listens on :45871)
//   AI_PROVIDER=openai-compatible AI_BASE_URL=http://127.0.0.1:45871/v1 AI_MODEL=stub npm run dev
// Output is NOT real analysis. Never use it outside local development.
import { startFakeAi } from '../tests/helpers/fakeAi.js';

const ai = startFakeAi();
ai.state.respond = (body) => {
  const text = body.messages.at(-1).content;
  const isOverview = !text.includes('<transcript_');
  if (isOverview) return { content: { overview: 'Stub overview of the merged parts.' } };
  const ids = [...text.slice(text.indexOf('<transcript_')).matchAll(/^\[(\d+)\]/gm)].map((m) => Number(m[1]));
  const first = ids[0] ?? 1;
  const second = ids[1] ?? first;
  return {
    content: {
      overview: '[STUB OUTPUT] The team reviewed progress and agreed on next steps. This text comes from the local stub AI server, not a real model.',
      key_points: [{ text: '[stub] A topic was discussed.', segment_ids: [first] }],
      decisions: [{ text: '[stub] A decision was recorded.', segment_ids: [second], owner: null }],
      action_items: [
        { task: '[stub] Follow up on the first item', assignee: null, due_date: null, due_date_text: 'by Friday', priority: 'medium', evidence: null, segment_ids: [first], confidence: 0.7 },
      ],
      risks: [], open_questions: [{ text: '[stub] An open question remains.', segment_ids: [second] }],
    },
  };
};
await ai.listen();
console.log('Stub AI listening on http://127.0.0.1:45871/v1 (dev only)');
