import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  env.RATE_LIMIT_ENABLED
    ? rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (_req, res) =>
          res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
      })
    : (_req, _res, next) => next();

export const apiLimiter = make(15 * 60_000, 600, 'Too many requests. Please slow down.');
export const authLimiter = make(
  15 * 60_000,
  30,
  'Too many sign-in attempts. Please try again in a few minutes.',
);
export const generateLimiter = make(
  60 * 60_000,
  30,
  'Hourly limit for AI generation reached. Please try again later.',
);
