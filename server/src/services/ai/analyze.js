import { env } from '../../config/env.js';
import { chunkSegments } from '../transcript/chunker.js';
import { AiError } from './errors.js';
import { extractionSchema, overviewSchema, toWireSchema } from './schema.js';
import {
  SYSTEM_PROMPT,
  OVERVIEW_SYSTEM_PROMPT,
  buildChunkPrompt,
  buildOverviewPrompt,
} from './prompts.js';
import { withRetries } from './providers.js';
import { resolveDueDate } from './dates.js';
import { dedupeActionItems, dedupeTextItems } from './merge.js';

const EXTRACTION_WIRE = toWireSchema(extractionSchema);
const OVERVIEW_WIRE = toWireSchema(overviewSchema);
const SCHEMA_RETRIES = 2;

/**
 * Calls the model and validates the result with zod. Malformed or schema-invalid
 * output is re-requested a limited number of times.
 */
export async function callValidated(provider, { system, user, zodSchema, wire, name }, usage) {
  let lastIssue = 'invalid output';
  for (let attempt = 0; attempt <= SCHEMA_RETRIES; attempt += 1) {
    let result;
    try {
      result = await withRetries(() =>
        provider.complete({ system, user, schema: wire, schemaName: name }),
      );
    } catch (e) {
      if (e instanceof AiError && e.code === 'AI_BAD_OUTPUT' && attempt < SCHEMA_RETRIES) {
        lastIssue = e.message;
        continue;
      }
      throw e;
    }
    usage.prompt += result.usage.prompt;
    usage.completion += result.usage.completion;
    const parsed = zodSchema.safeParse(result.json);
    if (parsed.success) return parsed.data;
    lastIssue = parsed.error.issues[0]?.path.join('.') || 'schema';
  }
  throw new AiError(
    'AI_BAD_OUTPUT',
    `The AI returned output that did not match the expected format (${lastIssue}). Your transcript is saved, so you can retry without uploading it again.`,
  );
}

const wordsIn = (s) => s.toLowerCase().match(/[a-z][a-z'’-]*/g) || [];

/** Names may only come from the transcript's speakers, listed participants, or words actually spoken. */
const makeNameChecker = (segments, participants = []) => {
  const vocab = new Set();
  for (const s of segments) {
    wordsIn(s.text).forEach((w) => vocab.add(w));
    if (s.speaker) wordsIn(s.speaker).forEach((w) => vocab.add(w));
  }
  participants.forEach((p) => wordsIn(p).forEach((w) => vocab.add(w)));
  return (name) => {
    if (!name) return null;
    const parts = name
      .split(/\s*(?:,|&|\/|\band\b)\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return null;
    const ok = parts.every((p) => {
      const first = wordsIn(p)[0];
      return first && vocab.has(first);
    });
    return ok ? name.trim() : null;
  };
};

const cleanIds = (ids, valid) => [...new Set(ids)].filter((id) => valid.has(id)).sort((a, b) => a - b);

/**
 * Drops anything citing segments that do not exist in the transcript, and
 * nulls out owners that never appear in it. Exposed for tests.
 */
export function sanitizeExtraction(raw, { validIds, segments, participants }) {
  const nameOk = makeNameChecker(segments, participants);
  const keepCited = (items, map = (x) => x) =>
    items
      .map((it) => ({ ...map(it), segment_ids: cleanIds(it.segment_ids, validIds) }))
      .filter((it) => it.segment_ids.length > 0);
  return {
    overview: raw.overview,
    key_points: keepCited(raw.key_points),
    decisions: keepCited(raw.decisions, (d) => ({ ...d, owner: nameOk(d.owner) })),
    action_items: keepCited(raw.action_items, (a) => ({
      ...a,
      assignee: nameOk(a.assignee),
      due_date_text: a.due_date_text || null,
    })),
    risks: keepCited(raw.risks),
    open_questions: keepCited(raw.open_questions),
  };
}

/**
 * Full pipeline: chunk -> extract per chunk -> sanitize -> merge/dedupe ->
 * (multi-chunk) final overview -> resolve due dates.
 * Independent of Express and Prisma; persistence is the caller's job.
 *
 * @param {object} p
 * @param {{title:string, meetingDate:Date|string, timezone:string, participants?:string[]}} p.meeting
 * @param {Array<{segment_id:number, speaker:string|null, start_ms:number|null, text:string}>} p.segments
 * @param {{complete:Function, model:string}} p.provider
 * @param {(stage:string)=>Promise<void>|void} [p.onStage] called when a stage is finished
 */
export async function analyzeMeeting({ meeting, segments, provider, onStage = async () => {}, limits = {} }) {
  const maxTokens = limits.chunkTokens ?? env.AI_CHUNK_TOKENS;
  const overlap = limits.overlap ?? env.AI_CHUNK_OVERLAP_SEGMENTS;
  const maxChunks = limits.maxChunks ?? env.MAX_CHUNKS_PER_MEETING;
  const usage = { prompt: 0, completion: 0 };

  const chunks = chunkSegments(segments, { maxTokens, overlap });
  if (chunks.length > maxChunks) {
    throw new AiError(
      'AI_TOO_LARGE',
      `This transcript is too long to process in one go (it would need ${chunks.length} AI requests; the limit is ${maxChunks}). Try splitting it into shorter meetings.`,
    );
  }

  const validIds = new Set(segments.map((s) => s.segment_id));
  const partials = [];
  for (const chunk of chunks) {
    let raw;
    try {
      raw = await callValidated(
        provider,
        {
          system: SYSTEM_PROMPT,
          user: buildChunkPrompt(meeting, chunk, { total: chunks.length }),
          zodSchema: extractionSchema,
          wire: EXTRACTION_WIRE,
          name: 'meeting_minutes',
        },
        usage,
      );
    } catch (e) {
      if (chunks.length > 1 && e instanceof AiError) {
        throw new AiError(
          e.code,
          `${e.userMessage} (failed on part ${chunk.index + 1} of ${chunks.length}; nothing was saved).`,
          { retryable: e.retryable, cause: e },
        );
      }
      throw e;
    }
    partials.push(sanitizeExtraction(raw, { validIds, segments, participants: meeting.participants }));
  }
  await onStage('analyze');

  const merged = {
    key_points: dedupeTextItems(partials.flatMap((p) => p.key_points)),
    decisions: dedupeTextItems(partials.flatMap((p) => p.decisions)),
    risks: dedupeTextItems(partials.flatMap((p) => p.risks)),
    open_questions: dedupeTextItems(partials.flatMap((p) => p.open_questions)),
    action_items: dedupeActionItems(partials.flatMap((p) => p.action_items)),
  };
  merged.key_points = merged.key_points.slice(0, 10);
  await onStage('extract');

  let overview = partials[0].overview;
  if (partials.length > 1) {
    const r = await callValidated(
      provider,
      {
        system: OVERVIEW_SYSTEM_PROMPT,
        user: buildOverviewPrompt(meeting, partials.map((p) => p.overview), merged.decisions),
        zodSchema: overviewSchema,
        wire: OVERVIEW_WIRE,
        name: 'meeting_overview',
      },
      usage,
    );
    overview = r.overview;
  }
  const actionItems = merged.action_items.map((a) => ({
    ...a,
    due_date: resolveDueDate(a.due_date_text, meeting.meetingDate),
  }));
  await onStage('prepare');

  return {
    minutes: {
      overview,
      key_points: merged.key_points,
      decisions: merged.decisions,
      risks: merged.risks,
      open_questions: merged.open_questions,
    },
    action_items: actionItems,
    usage,
    model: provider.model,
    chunkCount: chunks.length,
  };
}
