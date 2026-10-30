import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { isTest } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, unauthorized } from '../utils/errors.js';
import { ok } from '../utils/http.js';
import { COOKIE_NAME, cookieOptions, csrfFor, signSession } from '../middleware/auth.js';

const COST = isTest ? 4 : 12;
// Compared against when the email is unknown so response time doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

const startSession = (res, user) => {
  const { token, csrfToken } = signSession(user.id);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return { user: publicUser(user), csrfToken };
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, COST) },
  });
  ok(res, startSession(res, user), undefined, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized('Incorrect email or password.');
  ok(res, startSession(res, user));
});

export const logout = (_req, res) => {
  const { maxAge: _m, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
  ok(res, { loggedOut: true });
};

export const me = (req, res) => ok(res, { user: publicUser(req.user), csrfToken: csrfFor(req.sessionId) });
