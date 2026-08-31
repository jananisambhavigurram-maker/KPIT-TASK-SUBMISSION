import { processNextJob, recoverStaleJobs } from '../services/jobService.js';
let timer: NodeJS.Timeout | undefined;
export function startWorker(interval = Number(process.env.JOB_POLL_INTERVAL_MS ?? 1000)) {
  if (timer) return;
  timer = setInterval(() => { void processNextJob(); }, interval);
  void recoverStaleJobs().then(() => processNextJob());
}
export function stopWorker() { if (timer) clearInterval(timer); timer = undefined; }
