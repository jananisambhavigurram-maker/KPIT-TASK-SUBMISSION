import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const compact = (value: string) => (value.match(/[A-Za-z0-9]+/g)?.join('').slice(0, 6).toUpperCase() || 'PROJ');

async function main() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  for (const project of projects) {
    const projectKey = project.key ?? compact(project.name);
    await prisma.project.update({ where: { id: project.id }, data: { key: projectKey } });
    const stories = await prisma.userStory.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } });
    for (const [index, story] of stories.entries()) await prisma.userStory.update({ where: { id: story.id }, data: { key: story.key ?? `${projectKey}-US-${String(index + 1).padStart(3, '0')}` } });
    const tasks = await prisma.task.findMany({ where: { userStory: { projectId: project.id } }, orderBy: { createdAt: 'asc' } });
    for (const [index, task] of tasks.entries()) await prisma.task.update({ where: { id: task.id }, data: { key: task.key ?? `${projectKey}-T-${String(index + 1).padStart(3, '0')}` } });
  }
  console.log('Backfilled AgileFlow human-readable keys.');
}
main().finally(() => prisma.$disconnect());
