import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { prisma } from '../config/db.js';
import { unauthorized } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const COOKIE_NAME = 'mm_session';

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || isProd,
  sameSite: env.COOKIE_SAMESITE,
  maxAge: env.SESSION_DAYS * 86_400_000,
  path: '/',
});

export const signSession = (userId) => {
  const sid = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, sid }, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_DAYS}d`,
  });
  return { token, csrfToken: csrfFor(sid) };
};

// CSRF token is an HMAC of the session id: stateless, and readable by the
// client only through an authenticated API response (works cross-site too).
export const csrfFor = (sid) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`csrf:${sid}`).digest('hex');

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) throw unauthorized('Your session has expired. Please sign in again.');
  req.user = user;
  req.sessionId = payload.sid;
  next();
});
