import { fetchLikes } from './fetchLikes';
import { downloadAudio } from './downloadAudio';
import { analyzeAudio } from './analyzeAudio';
import { generateEmbeddings } from './generateEmbeddings';
import { getStats } from '../db/trackRepository';
import { logger } from '../utils/logger';

type Stage = 'fetch' | 'download' | 'analyze' | 'embed';

const STAGES: Stage[] = ['fetch', 'download', 'analyze', 'embed'];

const stageRunners: Record<Stage, () => Promise<any>> = {
  fetch: fetchLikes,
  download: downloadAudio,
  analyze: analyzeAudio,
  embed: generateEmbeddings,
};

export async function runPipeline(stage?: string): Promise<void> {
  const stages = stage ? [stage as Stage] : STAGES;

  logger.info('=== SoundCloud Background Music Pipeline ===');
  const startStats = await getStats();
  logger.info(`Current state: ${startStats.total} tracks, ${startStats.downloaded} downloaded, ${startStats.analyzed} analyzed, ${startStats.embedded} embedded`);

  for (const s of stages) {
    if (!STAGES.includes(s)) {
      logger.error(`Unknown stage: ${s}. Valid: ${STAGES.join(', ')}`);
      return;
    }

    logger.info(`\n--- Stage: ${s} ---`);
    const start = Date.now();

    try {
      const result = await stageRunners[s]();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      logger.info(`Stage ${s} completed in ${elapsed}s: ${JSON.stringify(result)}`);
    } catch (err: any) {
      logger.error(`Stage ${s} failed: ${err.message}`);
      throw err;
    }
  }

  const endStats = await getStats();
  logger.info(`\n=== Pipeline complete ===`);
  logger.info(`Final state: ${endStats.total} tracks, ${endStats.downloaded} downloaded, ${endStats.analyzed} analyzed, ${endStats.embedded} embedded`);
}
