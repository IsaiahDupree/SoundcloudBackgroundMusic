import { runPipeline } from './pipeline/orchestrator';
import { startServer } from './api/server';
import { searchMusic } from './search/queryEngine';
import { logger } from './utils/logger';
import { ensureDir } from './utils/fileHelpers';
import { AUDIO_DIR, PROJECT_ROOT } from './config/constants';
import path from 'path';

async function main() {
  // Ensure directories exist
  ensureDir(AUDIO_DIR);
  ensureDir(path.join(PROJECT_ROOT, 'logs'));

  const command = process.argv[2];

  switch (command) {
    case 'pipeline': {
      const stageArg = process.argv.find(a => a.startsWith('--stage='));
      const stage = stageArg?.split('=')[1];
      await runPipeline(stage);
      break;
    }

    case 'serve': {
      startServer();
      break;
    }

    case 'query': {
      const prompt = process.argv.slice(3).join(' ');
      if (!prompt) {
        console.log('Usage: node index.js query "chill lofi for coding"');
        process.exit(1);
      }
      const results = await searchMusic({ prompt, limit: 10 });
      console.log('\nSearch Results:');
      console.log('─'.repeat(60));
      for (const r of results) {
        console.log(`  ${(r.score * 100).toFixed(1)}% │ ${r.track.title} — ${r.track.artist}`);
        console.log(`       │ Genre: ${r.track.genre || 'N/A'} │ BPM: ${r.track.bpm_detected || '?'} │ Energy: ${r.track.energy?.toFixed(3) || '?'}`);
        if (r.reasons.length) console.log(`       │ ${r.reasons.join(', ')}`);
        console.log(`       │ ${r.track.sc_url}`);
        console.log('');
      }
      break;
    }

    default:
      console.log('SoundCloud Background Music System');
      console.log('');
      console.log('Commands:');
      console.log('  pipeline              Run full pipeline (fetch → download → analyze → embed)');
      console.log('  pipeline --stage=X    Run single stage: fetch, download, analyze, embed');
      console.log('  serve                 Start HTTP API server');
      console.log('  query "prompt"        Search music by natural language');
      console.log('');
      console.log('npm scripts:');
      console.log('  npm run pipeline      Full pipeline');
      console.log('  npm run serve         HTTP API');
      break;
  }
}

main().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
