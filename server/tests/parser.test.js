import { describe, expect, it } from 'vitest';
import { detectFormat, parseTranscript, timestampToMs } from '../src/services/transcript/parser.js';

describe('transcript parser', () => {
  it('parses plain speaker lines with null metadata when absent', () => {
    const s = parseTranscript('Rahul: We need to finish the backend API.\n\nPriya: I will work on the dashboard.');
    expect(s).toEqual([
      { segment_id: 1, speaker: 'Rahul', start_ms: null, end_ms: null, text: 'We need to finish the backend API.' },
      { segment_id: 2, speaker: 'Priya', start_ms: null, end_ms: null, text: 'I will work on the dashboard.' },
    ]);
  });

  it('parses bracketed timestamps', () => {
    const s = parseTranscript('[00:01:15] Rahul: The authentication API is ready.\n[00:02:30] Priya: I will test it tomorrow.');
    expect(s[0]).toMatchObject({ speaker: 'Rahul', start_ms: 75000, text: 'The authentication API is ready.' });
    expect(s[1].start_ms).toBe(150000);
  });

  it('does not invent speakers for unlabelled text and joins continuation lines', () => {
    const s = parseTranscript('Rahul: First line\ncontinues here\nJust some narration');
    expect(s).toHaveLength(1);
    expect(s[0].text).toBe('First line continues here Just some narration');
    const u = parseTranscript('We talked about the roadmap.\n\nThen we broke for lunch.');
    expect(u.map((x) => x.speaker)).toEqual([null, null]);
  });

  it('parses SRT with timing and speaker prefixes', () => {
    const srt = `1\n00:00:01,000 --> 00:00:03,500\nRahul: Hello everyone\n\n2\n00:00:04,000 --> 00:00:06,000\nWelcome back\nto the call\n`;
    const s = parseTranscript(srt, 'SRT');
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ speaker: 'Rahul', start_ms: 1000, end_ms: 3500, text: 'Hello everyone' });
    expect(s[1]).toMatchObject({ speaker: null, text: 'Welcome back to the call' });
  });

  it('parses VTT voice tags and ignores the header', () => {
    const vtt = `WEBVTT\n\n00:01.000 --> 00:03.000\n<v Priya>I'll send the <b>report</b>.</v>\n`;
    const s = parseTranscript(vtt, 'VTT');
    expect(s).toEqual([
      { segment_id: 1, speaker: 'Priya', start_ms: 1000, end_ms: 3000, text: "I'll send the report." },
    ]);
  });

  it('rejects malformed SRT/VTT with a helpful message', () => {
    expect(() => parseTranscript('just some text, no cues', 'SRT')).toThrow(/no valid timing cues/);
    expect(() => parseTranscript('WEBVTT\n\nhello', 'VTT')).toThrow(/no valid timing cues/);
  });

  it('rejects empty transcripts', () => {
    expect(() => parseTranscript('   \n ')).toThrow(/empty/);
  });

  it('handles markdown formatting', () => {
    const s = parseTranscript('# Standup\n\n- **Rahul:** Backend is done\n- **Priya:** Starting UI', 'MARKDOWN');
    expect(s.map((x) => x.speaker)).toEqual([null, 'Rahul', 'Priya']);
    expect(s[1].text).toBe('Backend is done');
  });

  it('splits very long segments but keeps ids sequential', () => {
    const long = `Rahul: ${'This is a sentence. '.repeat(400)}`;
    const s = parseTranscript(long);
    expect(s.length).toBeGreaterThan(1);
    expect(s.every((x) => x.speaker === 'Rahul' && x.text.length <= 3000)).toBe(true);
    expect(s.map((x) => x.segment_id)).toEqual(s.map((_, i) => i + 1));
  });

  it('detects formats', () => {
    expect(detectFormat('WEBVTT\n\n', '')).toBe('VTT');
    expect(detectFormat('1\n00:00:01,000 --> 00:00:02,000\nhi', '')).toBe('SRT');
    expect(detectFormat('hello', 'notes.md')).toBe('MARKDOWN');
    expect(detectFormat('hello')).toBe('TEXT');
  });

  it('converts timestamps', () => {
    expect(timestampToMs('01:02:03,500')).toBe(3723500);
    expect(timestampToMs('02:03')).toBe(123000);
    expect(timestampToMs('nope')).toBeNull();
  });
});
