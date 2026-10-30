import crypto from 'node:crypto';
import { clientOrigins } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { csrfFor } from './auth.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// 1) Origin check for every state-changing request (covers login/register).
export const originCheck = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !clientOrigins.includes(origin)) {
    return next(new AppError(403, 'BAD_ORIGIN', 'Request origin is not allowed.'));
  }
  next();
};

// 2) Token check for cookie-authenticated requests. Must run after requireAuth.
export const csrfProtect = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const sent = req.get('x-csrf-token') || '';
  const expected = csrfFor(req.sessionId);
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError(403, 'CSRF', 'Security token missing or invalid. Please refresh the page.'));
  }
  next();
};
