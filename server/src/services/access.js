import { prisma } from '../config/db.js';
import { notFound } from '../utils/errors.js';

// Every meeting / action-item lookup goes through these so ownership is always
// part of the query. Missing and foreign resources both return 404.
export async function getOwnedMeeting(id, userId, extra = {}) {
  const meeting = await prisma.meeting.findFirst({ where: { id, createdById: userId }, ...extra });
  if (!meeting) throw notFound('Meeting not found.');
  return meeting;
}

export async function getOwnedAction(id, userId) {
  const item = await prisma.actionItem.findFirst({
    where: { id, meeting: { createdById: userId } },
    include: { meeting: { select: { title: true } } },
  });
  if (!item) throw notFound('Action item not found.');
  return item;
}
