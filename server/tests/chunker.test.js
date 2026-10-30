import { describe, expect, it } from 'vitest';
import { chunkSegments } from '../src/services/transcript/chunker.js';

const segs = (n, len = 400) =>
  Array.from({ length: n }, (_, i) => ({ segment_id: i + 1, speaker: 'A', start_ms: null, text: 'x'.repeat(len) }));

describe('chunker', () => {
  it('keeps short transcripts in one chunk', () => {
    const c = chunkSegments(segs(3, 40), { maxTokens: 6000, overlap: 2 });
    expect(c).toHaveLength(1);
    expect(c[0].context).toEqual([]);
  });

  it('splits on segment boundaries, covers every segment once, and adds overlap context', () => {
    const all = segs(20); // ~108 tokens each
    const c = chunkSegments(all, { maxTokens: 500, overlap: 2 });
    expect(c.length).toBeGreaterThan(2);
    expect(c.flatMap((x) => x.segments.map((s) => s.segment_id))).toEqual(all.map((s) => s.segment_id));
    expect(c[1].context.map((s) => s.segment_id)).toEqual(
      c[0].segments.slice(-2).map((s) => s.segment_id),
    );
    expect(c[0].context).toEqual([]);
  });

  it('puts an oversized segment in its own chunk instead of looping', () => {
    const c = chunkSegments(segs(2, 10000), { maxTokens: 100, overlap: 0 });
    expect(c).toHaveLength(2);
  });
});
