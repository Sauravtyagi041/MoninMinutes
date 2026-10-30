import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, signup } from './helpers/app.js';

beforeEach(resetDb);

describe('auth', () => {
  it('registers, sets an HttpOnly cookie, and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Ada', email: 'Ada@Example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual({ id: expect.any(String), name: 'Ada', email: 'ada@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/mm_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('validates input and rejects duplicates', async () => {
    const bad = await request(app).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.details.length).toBeGreaterThan(1);
    await signup({ email: 'dup@example.com' });
    const dup = await request(app).post('/api/auth/register').send({ name: 'X', email: 'dup@example.com', password: 'password123' });
    expect(dup.status).toBe(409);
  });

  it('logs in with correct credentials only', async () => {
    const u = await signup();
    const ok = await request(app).post('/api/auth/login').send({ email: u.creds.email, password: u.creds.password });
    expect(ok.status).toBe(200);
    const wrong = await request(app).post('/api/auth/login').send({ email: u.creds.email, password: 'wrong-password1' });
    expect(wrong.status).toBe(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'password123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('protects private endpoints and supports /me and logout', async () => {
    expect((await request(app).get('/api/meetings')).status).toBe(401);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const u = await signup();
    const me = await u.get('/api/auth/me');
    expect(me.body.data.user.email).toBe(u.creds.email);
    const out = await u.agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    expect((await u.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects tampered or expired session tokens', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'mm_session=garbage.token.value');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('requires a CSRF token on state-changing authenticated requests', async () => {
    const u = await signup();
    const noToken = await u.agent.post('/api/meetings').send({ title: 'x', meetingDate: '2026-10-28', timezone: 'UTC' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF');
    const wrong = await u.agent.post('/api/meetings').set('X-CSRF-Token', 'abc').send({ title: 'x', meetingDate: '2026-10-28', timezone: 'UTC' });
    expect(wrong.status).toBe(403);
  });

  it('rejects disallowed origins on writes', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BAD_ORIGIN');
  });
});
