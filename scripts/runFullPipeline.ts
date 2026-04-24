/**
 * Run the FULL pipeline sequentially with error monitoring:
 * 1. Google Places city search (discover businesses)
 * 2. Social link scraping (find IG/FB/Twitter URLs)
 * 3. Google Places refresh (fresh details + photos → R2)
 * 4. Deal analysis (scrape social posts + Claude extraction)
 *
 * Each step checks for errors. If failures exceed threshold, pipeline stops.
 *
 * Usage: npx ts-node scripts/runFullPipeline.ts
 */

import axios from 'axios';

const API = 'http://localhost:3001';
const MAX_FAILURE_RATE = 0.1; // Stop if >10% of jobs fail

async function post(path: string, body: object = {}) {
  const res = await axios.post(`${API}${path}`, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

async function getQueueStats(queue: string) {
  const { Queue } = await import('bullmq');
  const q = new Queue(queue, { connection: { host: 'localhost', port: 6379 } });
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);
  await q.close();
  return { waiting, active, delayed, completed, failed, pending: waiting + active + delayed };
}

async function stopAllQueues() {
  const { Queue } = await import('bullmq');
  for (const name of ['google-places', 'social-scraper', 'deal-analyzer']) {
    const q = new Queue(name, { connection: { host: 'localhost', port: 6379 } });
    await q.obliterate({ force: true });
    await q.close();
  }
}

async function getFailedReasons(queue: string, count: number = 3) {
  const { Queue } = await import('bullmq');
  const q = new Queue(queue, { connection: { host: 'localhost', port: 6379 } });
  const jobs = await q.getFailed(0, count);
  await q.close();
  return jobs.map(j => j.failedReason?.slice(0, 120) ?? 'unknown');
}

async function waitForQueue(
  queue: string,
  label: string,
  totalJobs: number,
  checkMidway: boolean = false
): Promise<boolean> {
  let elapsed = 0;
  let midwayChecked = false;

  while (true) {
    const stats = await getQueueStats(queue);

    // Check if done
    if (stats.pending === 0) {
      const failRate = totalJobs > 0 ? stats.failed / totalJobs : 0;
      console.log(`✓ ${label} complete (${elapsed}s) — ${stats.completed} succeeded, ${stats.failed} failed`);

      if (stats.failed > 0) {
        console.log(`  Failure rate: ${(failRate * 100).toFixed(1)}%`);
        const reasons = await getFailedReasons(queue);
        reasons.forEach(r => console.log(`  Error: ${r}`));
      }

      if (failRate > MAX_FAILURE_RATE) {
        console.log(`\n⛔ STOPPING — failure rate ${(failRate * 100).toFixed(1)}% exceeds ${MAX_FAILURE_RATE * 100}% threshold`);
        await stopAllQueues();
        return false;
      }

      console.log('');
      return true;
    }

    // Midway check
    if (checkMidway && !midwayChecked && stats.completed + stats.failed >= totalJobs / 2) {
      midwayChecked = true;
      const failRate = (stats.completed + stats.failed) > 0 ? stats.failed / (stats.completed + stats.failed) : 0;
      console.log(`  📊 Midway check: ${stats.completed} succeeded, ${stats.failed} failed (${(failRate * 100).toFixed(1)}% failure rate)`);

      if (failRate > MAX_FAILURE_RATE) {
        console.log(`\n⛔ STOPPING AT MIDWAY — failure rate ${(failRate * 100).toFixed(1)}% exceeds threshold`);
        const reasons = await getFailedReasons(queue);
        reasons.forEach(r => console.log(`  Error: ${r}`));
        await stopAllQueues();
        return false;
      }
    }

    // Progress log every 20s
    elapsed += 5;
    if (elapsed % 20 === 0) {
      console.log(`  [${queue}] completed: ${stats.completed} | failed: ${stats.failed} | active: ${stats.active} | delayed: ${stats.delayed} (${elapsed}s)`);
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function main() {
  const startTime = Date.now();
  console.log('════════════════════════════════════════');
  console.log('  FULL PIPELINE - WITH ERROR MONITORING');
  console.log('════════════════════════════════════════\n');

  // Step 1: Google Places city search
  console.log('Step 1/4: Google Places city search for Austin...');
  const searchResult = await post('/api/data-collection/google/search/city', { city: 'austin' });
  console.log(`  Queued ${searchResult.searchPoints} search jobs`);
  const step1ok = await waitForQueue('google-places', 'Google Places search', searchResult.searchPoints);
  if (!step1ok) return;

  // Step 2: Social link scraping
  console.log('Step 2/4: Scraping social links from all business websites...');
  const socialResult = await post('/api/data-collection/social/scrape/all');
  console.log(`  Queued ${socialResult.count} social scraping jobs`);
  const step2ok = await waitForQueue('social-scraper', 'Social link scraping', socialResult.count);
  if (!step2ok) return;

  // Step 3: Refresh all business details + sync photos to R2
  console.log('Step 3/4: Refreshing all business details + caching photos to R2...');
  const refreshResult = await post('/api/data-collection/google/refresh');
  console.log(`  Queued ${refreshResult.count} refresh jobs`);
  const step3ok = await waitForQueue('google-places', 'Business details refresh + photo sync', refreshResult.count, true);
  if (!step3ok) return;

  // Step 4: Deal analysis (all sources)
  console.log('Step 4/4: Deal analysis (website + social media + Claude)...');
  const dealResult = await post('/api/data-collection/deals/analyze/all');
  console.log(`  Queued ${dealResult.count} analysis jobs`);
  console.log(`  Breakdown: ${JSON.stringify(dealResult.breakdown)}`);
  const step4ok = await waitForQueue('deal-analyzer', 'Deal analysis + aggregation', dealResult.count);
  if (!step4ok) return;

  // Final stats
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  const [businesses, socialLinks, pending, production] = await Promise.all([
    p.googleRawBusiness.count(),
    p.businessSocialLink.count({ where: { scrapeStatus: 'success' } }),
    p.pendingDealAustin.count(),
    p.productionDealAustin.count(),
  ]);
  await p.$disconnect();

  const totalMinutes = Math.round((Date.now() - startTime) / 60000);

  console.log('════════════════════════════════════════');
  console.log('  PIPELINE COMPLETE — ALL STEPS PASSED');
  console.log('════════════════════════════════════════');
  console.log(`  Total time: ${totalMinutes} minutes`);
  console.log(`  Businesses in DB: ${businesses}`);
  console.log(`  Social links found: ${socialLinks}`);
  console.log(`  Pending deals: ${pending}`);
  console.log(`  Production deals: ${production}`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
