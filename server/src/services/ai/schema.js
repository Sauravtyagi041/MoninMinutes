import { z } from 'zod';

const segmentIds = z.array(z.number().int().positive()).max(30);
const text = z.string().trim().min(1).max(1500);

export const extractionSchema = z.object({
  overview: z.string().trim().min(1).max(2500),
  key_points: z.array(z.object({ text, segment_ids: segmentIds })).max(15),
  decisions: z
    .array(z.object({ text, segment_ids: segmentIds, owner: z.string().trim().max(120).nullable() }))
    .max(30),
  action_items: z
    .array(
      z.object({
        task: z.string().trim().min(1).max(600),
        assignee: z.string().trim().max(120).nullable(),
        due_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        due_date_text: z.string().trim().max(200).nullable(),
        priority: z.enum(['low', 'medium', 'high']),
        evidence: z.string().trim().max(1000).nullable(),
        segment_ids: segmentIds,
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(80),
  risks: z.array(z.object({ text, segment_ids: segmentIds })).max(30),
  open_questions: z.array(z.object({ text, segment_ids: segmentIds })).max(30),
});

export const overviewSchema = z.object({ overview: z.string().trim().min(1).max(2500) });

// Keywords OpenAI strict mode / Anthropic tool schemas don't need; validation
// is enforced locally by the zod schemas above.
const DROP = new Set([
  '$schema', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'pattern', 'format', 'exclusiveMinimum', 'exclusiveMaximum',
]);
const strip = (node) => {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !DROP.has(k))
        .map(([k, v]) => [k, strip(v)]),
    );
  }
  return node;
};

export const toWireSchema = (zodSchema) => strip(z.toJSONSchema(zodSchema, { io: 'output' }));
