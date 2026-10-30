// Rough token estimate; avoids a tokenizer dependency. Budgets are configurable
// per model via AI_CHUNK_TOKENS, so over/under-estimation only shifts chunk size.
export const estimateTokens = (text) => Math.ceil(text.length / 4);

export const segmentTokens = (seg) => estimateTokens(seg.text) + estimateTokens(seg.speaker || '') + 8;

/**
 * Splits segments into consecutive chunks under `maxTokens`.
 * Segment boundaries (and therefore speaker turns) are never broken.
 * Each chunk carries `context`: up to `overlap` preceding segments that are shown
 * to the model for continuity but must not be extracted from again.
 */
export const chunkSegments = (segments, { maxTokens, overlap = 0 }) => {
  const chunks = [];
  let current = [];
  let used = 0;
  let start = 0;
  const flush = (endExclusive) => {
    if (!current.length) return;
    chunks.push({
      index: chunks.length,
      segments: current,
      context: segments.slice(Math.max(0, start - overlap), start),
    });
    current = [];
    used = 0;
    start = endExclusive;
  };
  segments.forEach((seg, i) => {
    const t = segmentTokens(seg);
    if (current.length && used + t > maxTokens) flush(i);
    current.push(seg);
    used += t;
  });
  flush(segments.length);
  return chunks;
};
