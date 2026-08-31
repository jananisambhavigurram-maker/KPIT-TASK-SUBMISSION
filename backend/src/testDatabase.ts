import { copyFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const database = resolve(root, 'prisma/test.db');
const templateDatabase = resolve(root, 'prisma/dev.db');

export default async function setup() {
  process.env.DATABASE_URL = 'file:./test.db';
  for (const path of [database, `${database}-journal`]) { try { rmSync(path); } catch { /* no prior test database */ } }
  copyFileSync(templateDatabase, database);
  return () => { for (const path of [database, `${database}-journal`]) { try { rmSync(path); } catch { /* test database may already be absent */ } } };
}
