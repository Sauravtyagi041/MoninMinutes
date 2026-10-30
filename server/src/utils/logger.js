import { isTest } from '../config/env.js';

// Deliberately never logs request bodies or transcript content.
const write = (level, msg, meta) => {
  if (isTest && level !== 'error') return;
  const line = { t: new Date().toISOString(), level, msg, ...meta };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
};

export const logger = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
