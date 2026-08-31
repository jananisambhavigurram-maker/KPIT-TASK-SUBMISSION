import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { startWorker, stopWorker } from './workers/worker.js';
const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, () => { console.log(`AgileFlow API listening on http://localhost:${port}`); startWorker(); });
async function shutdown() { stopWorker(); server.close(); await prisma.$disconnect(); }
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
