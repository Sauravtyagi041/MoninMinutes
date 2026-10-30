import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { detectFormat, parseTranscript } from './transcript/parser.js';

export const ALLOWED_EXT = ['txt', 'md', 'srt', 'vtt'];

export function decodeUpload(file) {
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (!ALLOWED_EXT.includes(ext)) {
    throw badRequest('Unsupported file type. Please upload a .txt, .md, .srt or .vtt file.');
  }
  if (file.size === 0) throw badRequest('The uploaded file is empty.');
  if (file.buffer.includes(0)) {
    throw badRequest('This file looks like a binary file, not a text transcript.');
  }
  const text = new TextDecoder('utf-8').decode(file.buffer).replace(/^﻿/, '');
  const bad = (text.match(/�/g) || []).length;
  if (bad > Math.max(5, text.length * 0.01)) {
    throw badRequest('This file is not valid UTF-8 text. Please save it as UTF-8 and try again.');
  }
  return { text, filename: file.originalname };
}

/** Validates, detects the format and parses; returns everything needed to persist. */
export function prepareTranscript({ text, filename, format }) {
  if (typeof text !== 'string' || !text.trim()) throw badRequest('The transcript is empty.');
  if (text.length > env.MAX_TRANSCRIPT_CHARS) {
    throw badRequest(
      `This transcript is too long (${text.length.toLocaleString()} characters; limit ${env.MAX_TRANSCRIPT_CHARS.toLocaleString()}).`,
    );
  }
  const fmt = format || detectFormat(text, filename);
  const segments = parseTranscript(text, fmt);
  return { text, format: fmt, segments };
}
