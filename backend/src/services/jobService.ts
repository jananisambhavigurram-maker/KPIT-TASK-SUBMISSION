import { JobStatus } from '@prisma/client';
import { prisma } from '../db.js';

export type AssignmentPayload = { taskId: string; userId: string; assignmentVersion: string };
export async function queueAssignmentNotification(payload: AssignmentPayload) {
  return prisma.backgroundJob.create({ data: { type: 'TASK_ASSIGNED', payload: JSON.stringify(payload) } });
}
export async function recoverStaleJobs(staleAfterMs = Number(process.env.JOB_STALE_AFTER_MS ?? 60_000)) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  return prisma.backgroundJob.updateMany({ where: { status: JobStatus.PROCESSING, lockedAt: { lt: cutoff } }, data: { status: JobStatus.PENDING, lockedAt: null, lastError: 'Recovered stale processing job' } });
}
export async function processNextJob() {
  const job = await prisma.backgroundJob.findFirst({ where: { status: JobStatus.PENDING, runAfter: { lte: new Date() } }, orderBy: { createdAt: 'asc' } });
  if (!job) return false;
  const claimed = await prisma.backgroundJob.updateMany({ where: { id: job.id, status: JobStatus.PENDING }, data: { status: JobStatus.PROCESSING, lockedAt: new Date(), attempts: { increment: 1 } } });
  if (!claimed.count) return false;
  try {
    if (job.type !== 'TASK_ASSIGNED') throw new Error(`Unsupported job type ${job.type}`);
    const payload = JSON.parse(job.payload) as AssignmentPayload;
    const task = await prisma.task.findUnique({ where: { id: payload.taskId }, select: { title: true, assignedToId: true, updatedAt: true } });
    if (!task || task.assignedToId !== payload.userId) {
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: JobStatus.COMPLETED, lockedAt: null } });
      return true;
    }
    const duplicate = await prisma.notification.findUnique({ where: { sourceJobId: job.id } });
    if (!duplicate) await prisma.notification.create({ data: { userId: payload.userId, type: 'TASK_ASSIGNED', message: `You have been assigned a new task: ${task.title}`, sourceJobId: job.id } });
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: JobStatus.COMPLETED, lockedAt: null, lastError: null } });
    console.info(JSON.stringify({ event: 'job.completed', jobId: job.id, type: job.type }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown job error';
    const attempts = job.attempts + 1;
    await prisma.backgroundJob.update({ where: { id: job.id }, data: attempts >= job.maxAttempts ? { status: JobStatus.FAILED, lockedAt: null, lastError: message } : { status: JobStatus.PENDING, lockedAt: null, lastError: message, runAfter: new Date(Date.now() + attempts * 1000) } });
    console.warn(JSON.stringify({ event: attempts >= job.maxAttempts ? 'job.failed' : 'job.retry', jobId: job.id, type: job.type, attempts }));
  }
  return true;
}
