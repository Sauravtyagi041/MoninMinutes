import { beforeEach, describe, expect, it } from 'vitest';
import { createMeeting, resetDb, signup } from './helpers/app.js';

beforeEach(resetDb);

describe('action items', () => {
  it('creates manual items, edits every field, and deletes', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    const c = await u.post(`/api/meetings/${m.id}/action-items`).send({ task: 'Fix login bug', assignee: 'Rahul', dueDate: '2026-11-05', priority: 'high' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ task: 'Fix login bug', assignee: 'Rahul', dueDate: '2026-11-05', priority: 'high', status: 'pending', origin: 'manual', confidence: null });
    const id = c.body.data.id;
    const p = await u.patch(`/api/action-items/${id}`).send({ task: 'Fix SSO login bug', assignee: '', dueDate: null, priority: 'low', status: 'in_progress' });
    expect(p.body.data).toMatchObject({ task: 'Fix SSO login bug', assignee: null, dueDate: null, priority: 'low', status: 'in_progress', userEdited: true });
    expect((await u.delete(`/api/action-items/${id}`)).status).toBe(200);
    expect((await u.patch(`/api/action-items/${id}`).send({ task: 'x' })).status).toBe(404);
  });

  it('rejects invalid values', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    expect((await u.post(`/api/meetings/${m.id}/action-items`).send({ task: '' })).status).toBe(400);
    expect((await u.post(`/api/meetings/${m.id}/action-items`).send({ task: 'x', dueDate: 'Friday' })).status).toBe(400);
    expect((await u.post(`/api/meetings/${m.id}/action-items`).send({ task: 'x', priority: 'urgent' })).status).toBe(400);
  });

  it('lists across meetings with filters, nulls-last deadline sorting, and correct overdue stats', async () => {
    const u = await signup();
    const m1 = await createMeeting(u, { title: 'One' });
    const m2 = await createMeeting(u, { title: 'Two' });
    const add = (m, body) => u.post(`/api/meetings/${m.id}/action-items`).send(body);
    await add(m1, { task: 'Past due open', assignee: 'Rahul', dueDate: '2020-01-01' });
    await add(m1, { task: 'Past due done', assignee: 'Rahul', dueDate: '2020-02-01', status: 'completed' });
    await add(m2, { task: 'Future', assignee: 'Priya', dueDate: '2999-01-01', priority: 'high' });
    await add(m2, { task: 'No deadline at all' });

    const list = await u.get('/api/action-items');
    expect(list.body.data.map((i) => i.task)).toEqual(['Past due open', 'Past due done', 'Future', 'No deadline at all']);
    expect(list.body.meta.stats).toEqual({ total: 4, completed: 1, pending: 3, inProgress: 0, overdue: 1 });
    expect(list.body.meta.assignees).toEqual(['Priya', 'Rahul']);
    const byTask = Object.fromEntries(list.body.data.map((i) => [i.task, i]));
    expect(byTask['Past due open'].overdue).toBe(true);
    expect(byTask['Past due done'].overdue).toBe(false); // completed
    expect(byTask['No deadline at all'].overdue).toBe(false); // no due date is never overdue

    const desc = await u.get('/api/action-items?sort=dueDate&order=desc');
    expect(desc.body.data.at(-1).task).toBe('No deadline at all'); // still last
    expect((await u.get('/api/action-items?overdue=true')).body.data.map((i) => i.task)).toEqual(['Past due open']);
    expect((await u.get('/api/action-items?assignee=priya')).body.data).toHaveLength(1);
    expect((await u.get('/api/action-items?priority=high&status=pending')).body.data).toHaveLength(1);
    expect((await u.get('/api/action-items?q=deadline')).body.data).toHaveLength(1);
    expect((await u.get(`/api/action-items?meetingId=${m1.id}`)).body.data).toHaveLength(2);
  });

  it('dashboard stats are computed from stored data', async () => {
    const u = await signup();
    const empty = await u.get('/api/dashboard/stats');
    expect(empty.body.data).toMatchObject({ totalMeetings: 0, meetingsProcessed: 0, actionItems: { total: 0, pending: 0, completed: 0, overdue: 0 } });
    const m = await createMeeting(u);
    await u.post(`/api/meetings/${m.id}/action-items`).send({ task: 'a' });
    await u.post(`/api/meetings/${m.id}/action-items`).send({ task: 'b', status: 'completed' });
    const s = (await u.get('/api/dashboard/stats')).body.data;
    expect(s.totalMeetings).toBe(1);
    expect(s.actionItems).toMatchObject({ total: 2, pending: 1, completed: 1, byStatus: { pending: 1, in_progress: 0, completed: 1 } });
    expect(s.recentMeetings[0].actionItemCount).toBe(2);
    expect(s.pendingActionItems.map((i) => i.task)).toEqual(['a']);
  });
});
