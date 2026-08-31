import { prisma } from '../db.js';
export function createActivity(projectId: string, message: string, type: string, actorId?: string) {
  return prisma.activity.create({ data: { projectId, message, type, actorId } });
}
