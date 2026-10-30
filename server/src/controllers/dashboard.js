import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';
import { serializeAction, serializeMeeting } from '../utils/serialize.js';

export const stats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const owner = { meeting: { createdById: userId } };
  const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [totalMeetings, processed, processedThisMonth, grouped, overdue, recent, pendingItems] =
    await Promise.all([
      prisma.meeting.count({ where: { createdById: userId } }),
      prisma.meeting.count({ where: { createdById: userId, minutes: { isNot: null } } }),
      prisma.meetingMinutes.count({
        where: { generatedAt: { gte: monthStart }, meeting: { createdById: userId } },
      }),
      prisma.actionItem.groupBy({ by: ['status'], where: owner, _count: true }),
      prisma.actionItem.count({ where: { ...owner, dueDate: { lt: todayUtc }, status: { not: 'COMPLETED' } } }),
      prisma.meeting.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { _count: { select: { actionItems: true } } },
      }),
      prisma.actionItem.findMany({
        where: { ...owner, status: { not: 'COMPLETED' } },
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: 6,
        include: { meeting: { select: { title: true } } },
      }),
    ]);
  const by = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  ok(res, {
    totalMeetings,
    meetingsProcessed: processed,
    meetingsProcessedThisMonth: processedThisMonth,
    actionItems: {
      total,
      pending: total - (by.COMPLETED ?? 0),
      completed: by.COMPLETED ?? 0,
      overdue,
      byStatus: { pending: by.PENDING ?? 0, in_progress: by.IN_PROGRESS ?? 0, completed: by.COMPLETED ?? 0 },
    },
    recentMeetings: recent.map(serializeMeeting),
    pendingActionItems: pendingItems.map(serializeAction),
  });
});
