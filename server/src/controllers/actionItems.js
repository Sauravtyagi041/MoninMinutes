import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, pageMeta, pageParams } from '../utils/http.js';
import { dateOnly, serializeAction, toEnum } from '../utils/serialize.js';
import { getOwnedAction, getOwnedMeeting } from '../services/access.js';

const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

export const list = asyncHandler(async (req, res) => {
  const { q, status, priority, assignee, overdue, meetingId, sort, order } = req.query;
  const paging = pageParams(req.query, { page: 1, pageSize: 20 });
  const owner = { meeting: { createdById: req.user.id } };
  const where = {
    ...owner,
    ...(status && { status: toEnum(status) }),
    ...(priority && { priority: toEnum(priority) }),
    ...(meetingId && { meetingId }),
    ...(assignee && { assignee: { equals: assignee, mode: 'insensitive' } }),
    ...(q && { task: { contains: q, mode: 'insensitive' } }),
    ...(overdue === 'true' && { dueDate: { lt: today() }, status: { not: 'COMPLETED' } }),
  };
  // Tasks without a due date always sort last when sorting by deadline.
  const orderBy =
    sort === 'dueDate'
      ? [{ dueDate: { sort: order, nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ [sort]: order }, { createdAt: 'desc' }];

  const [total, rows, grouped, overdueCount, assignees] = await Promise.all([
    prisma.actionItem.count({ where }),
    prisma.actionItem.findMany({
      where, orderBy, skip: paging.skip, take: paging.take,
      include: { meeting: { select: { title: true } } },
    }),
    prisma.actionItem.groupBy({ by: ['status'], where: owner, _count: true }),
    prisma.actionItem.count({ where: { ...owner, dueDate: { lt: today() }, status: { not: 'COMPLETED' } } }),
    prisma.actionItem.findMany({
      where: { ...owner, assignee: { not: null } }, distinct: ['assignee'], select: { assignee: true }, orderBy: { assignee: 'asc' },
    }),
  ]);
  const by = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const completed = by.COMPLETED ?? 0;
  const all = Object.values(by).reduce((a, b) => a + b, 0);
  ok(res, rows.map(serializeAction), {
    ...pageMeta(paging, total),
    stats: { total: all, completed, pending: all - completed, inProgress: by.IN_PROGRESS ?? 0, overdue: overdueCount },
    assignees: assignees.map((a) => a.assignee),
  });
});

export const create = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, { select: { id: true } });
  const b = req.body;
  const item = await prisma.actionItem.create({
    data: {
      meetingId: meeting.id,
      task: b.task,
      assignee: b.assignee ?? null,
      dueDate: dateOnly(b.dueDate),
      priority: toEnum(b.priority),
      status: toEnum(b.status),
      origin: 'MANUAL',
      userEdited: true,
    },
    include: { meeting: { select: { title: true } } },
  });
  ok(res, serializeAction(item), undefined, 201);
});

export const update = asyncHandler(async (req, res) => {
  const existing = await getOwnedAction(req.params.id, req.user.id);
  const b = req.body;
  const data = {
    userEdited: true,
    ...(b.task !== undefined && { task: b.task }),
    ...(b.assignee !== undefined && { assignee: b.assignee }),
    ...(b.dueDate !== undefined && { dueDate: dateOnly(b.dueDate) }),
    ...(b.priority !== undefined && { priority: toEnum(b.priority) }),
    ...(b.status !== undefined && { status: toEnum(b.status) }),
  };
  const item = await prisma.actionItem.update({
    where: { id: existing.id }, data, include: { meeting: { select: { title: true } } },
  });
  ok(res, serializeAction(item));
});

export const remove = asyncHandler(async (req, res) => {
  const existing = await getOwnedAction(req.params.id, req.user.id);
  await prisma.actionItem.delete({ where: { id: existing.id } });
  ok(res, { deleted: true });
});
