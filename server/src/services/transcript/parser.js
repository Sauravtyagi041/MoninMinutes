import { badRequest } from '../../utils/errors.js';

const MAX_SEGMENT_CHARS = 3000;

const TS = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
const CUE_RE = new RegExp(`^(${TS})\\s*-->\\s*(${TS})`);
const BRACKET_TS_RE = new RegExp(`^[\\[(]\\s*(${TS})\\s*[\\])]\\s*[-–—]?\\s*(.*)$`);
const BARE_TS_RE = new RegExp(`^(${TS})\\s+[-–—]?\\s*(.*)$`);
// "Name: text" — up to four words, must start with a letter.
const SPEAKER_RE = /^([A-Za-z][\w'’.-]*(?:\s+[A-Za-z][\w'’.-]*){0,3})\s*:\s+(\S.*)$/;

export const FORMATS = { TEXT: 'TEXT', MARKDOWN: 'MARKDOWN', SRT: 'SRT', VTT: 'VTT' };

export class TranscriptParseError extends Error {}

export const timestampToMs = (ts) => {
  const m = ts.replace(',', '.').match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const [, h = '0', mi, s, frac = '0'] = m;
  return (
    ((Number(h) * 60 + Number(mi)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, '0'))
  );
};

export const detectFormat = (text, filename = '') => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'srt') return FORMATS.SRT;
  if (ext === 'vtt') return FORMATS.VTT;
  if (ext === 'md') return FORMATS.MARKDOWN;
  if (ext === 'txt') return FORMATS.TEXT;
  if (/^﻿?WEBVTT/.test(text)) return FORMATS.VTT;
  if (/^\s*\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text)) return FORMATS.SRT;
  return FORMATS.TEXT;
};

const stripMarkup = (s) =>
  s
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

// Splits over-long text on sentence boundaries so segments stay small and citeable.
const splitLong = (text) => {
  if (text.length <= MAX_SEGMENT_CHARS) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [text];
  const parts = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + s).length > MAX_SEGMENT_CHARS) {
      parts.push(cur.trim());
      cur = '';
    }
    cur += s;
    while (cur.length > MAX_SEGMENT_CHARS) {
      parts.push(cur.slice(0, MAX_SEGMENT_CHARS).trim());
      cur = cur.slice(MAX_SEGMENT_CHARS);
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const finalize = (raw) => {
  const out = [];
  for (const seg of raw) {
    const text = seg.text.trim();
    if (!text) continue;
    for (const piece of splitLong(text)) {
      out.push({
        segment_id: out.length + 1,
        speaker: seg.speaker ?? null,
        start_ms: seg.start_ms ?? null,
        end_ms: seg.end_ms ?? null,
        text: piece,
      });
    }
  }
  return out;
};

const splitSpeaker = (text) => {
  const clean = text.replace(/^\s*[-*•]\s+/, '').replace(/\*\*|__/g, '');
  const m = clean.match(SPEAKER_RE);
  // A trailing-colon "speaker" like "Note" or "TODO" is still a label; we only
  // reject things that look like times ("10: 30") or URLs.
  if (m && !/^\d+$/.test(m[1]) && !/^https?$/i.test(m[1])) return { speaker: m[1].trim(), text: m[2].trim() };
  return { speaker: null, text: clean.trim() };
};

const parseCueBlocks = (text, format) => {
  const blocks = text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/);
  const raw = [];
  let cues = 0;
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const idx = lines.findIndex((l) => CUE_RE.test(l.trim()));
    if (idx === -1) continue;
    const m = lines[idx].trim().match(CUE_RE);
    cues += 1;
    const body = lines.slice(idx + 1).join(' ');
    let speaker = null;
    let content = body;
    const v = body.match(/<v(?:\.[\w.]+)?\s+([^>]+)>/i);
    if (v) speaker = v[1].trim();
    content = stripMarkup(content);
    if (!speaker) {
      const sp = splitSpeaker(content);
      speaker = sp.speaker;
      content = sp.text;
    }
    raw.push({ speaker, text: content, start_ms: timestampToMs(m[1]), end_ms: timestampToMs(m[2]) });
  }
  if (cues === 0) {
    throw new TranscriptParseError(
      `This ${format} file has no valid timing cues (expected lines like "00:00:01,000 --> 00:00:03,000"). Check the file or paste it as plain text.`,
    );
  }
  return raw;
};

const parsePlain = (text, format) => {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const raw = [];
  let prev = null; // last segment, for continuation lines
  for (const original of lines) {
    let line = original.trim();
    if (!line) {
      prev = null;
      continue;
    }
    if (format === FORMATS.MARKDOWN) {
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        prev = null;
        continue;
      }
      line = line.replace(/^#{1,6}\s+/, '');
    }
    let start = null;
    const b = line.match(BRACKET_TS_RE) || line.match(BARE_TS_RE);
    if (b && timestampToMs(b[1]) !== null) {
      start = timestampToMs(b[1]);
      line = b[2];
    }
    const { speaker, text: body } = splitSpeaker(line);
    if (!body) continue;
    const isLabelled = speaker !== null || start !== null;
    if (!isLabelled && prev) {
      prev.text += ` ${body}`;
      continue;
    }
    prev = { speaker, text: body, start_ms: start, end_ms: null };
    raw.push(prev);
  }
  return raw;
};

export const parseTranscript = (text, format = FORMATS.TEXT) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw badRequest('The transcript is empty.');
  }
  let raw;
  try {
    raw = format === FORMATS.SRT || format === FORMATS.VTT ? parseCueBlocks(text, format) : parsePlain(text, format);
  } catch (e) {
    if (e instanceof TranscriptParseError) throw badRequest(e.message);
    throw e;
  }
  const segments = finalize(raw);
  if (segments.length === 0) throw badRequest('No readable text was found in the transcript.');
  return segments;
};

export const speakersOf = (segments) => [
  ...new Set(segments.map((s) => s.speaker).filter(Boolean)),
];

export const formatTimestamp = (ms) => {
  if (ms == null) return null;
  const s = Math.floor(ms / 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};
