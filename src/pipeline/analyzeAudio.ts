import { getUnanalyzed, updateAudioFeatures, markAnalysisError } from '../db/trackRepository';
import { ffprobeExtract } from '../analysis/ffprobeExtractor';
import { extractMeydaFeatures } from '../analysis/meydaExtractor';
import { TrackRow, AudioFeatures } from '../types/track';
import { getAudioPath, fileExists } from '../utils/fileHelpers';
import { logger } from '../utils/logger';

async function analyzeTrack(track: TrackRow): Promise<boolean> {
  const audioPath = getAudioPath(track.sc_track_id);

  if (!fileExists(audioPath)) {
    await markAnalysisError(track.id, 'Audio file not found');
    return false;
  }

  try {
    logger.info(`  Analyzing: ${track.title}`);

    // Run ffprobe and Meyda in parallel
    const [probeResult, meydaResult] = await Promise.all([
      ffprobeExtract(audioPath),
      extractMeydaFeatures(audioPath),
    ]);

    const features: AudioFeatures = {
      audio_duration_sec: probeResult.duration,
      audio_bitrate: probeResult.bitrate,
      audio_sample_rate: probeResult.sampleRate,
      audio_codec: probeResult.codec,
      bpm_detected: meydaResult.bpmEstimate,
      energy: meydaResult.energy,
      spectral_centroid: meydaResult.spectralCentroid,
      spectral_rolloff: meydaResult.spectralRolloff,
      loudness: meydaResult.loudness,
      zero_crossing_rate: meydaResult.zeroCrossingRate,
      mfcc: meydaResult.mfcc,
    };

    await updateAudioFeatures(track.id, features);
    logger.info(`  ✓ Analyzed: ${track.title} — BPM:${features.bpm_detected || '?'} Energy:${features.energy.toFixed(3)}`);
    return true;
  } catch (err: any) {
    logger.error(`  ✗ Analysis failed: ${track.title} — ${err.message}`);
    await markAnalysisError(track.id, err.message.substring(0, 500));
    return false;
  }
}

export async function analyzeAudio(): Promise<{ analyzed: number; failed: number }> {
  let analyzed = 0;
  let failed = 0;

  logger.info('Starting audio analysis pipeline...');

  while (true) {
    const batch = await getUnanalyzed(10);
    if (batch.length === 0) break;

    // Process 2 at a time (CPU-bound)
    for (let i = 0; i < batch.length; i += 2) {
      const chunk = batch.slice(i, i + 2);
      const results = await Promise.allSettled(chunk.map(t => analyzeTrack(t)));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          analyzed++;
        } else {
          failed++;
        }
      }
    }

    logger.info(`Analysis progress: ${analyzed} done, ${failed} failed`);
  }

  logger.info(`Analysis complete: ${analyzed} analyzed, ${failed} failed`);
  return { analyzed, failed };
}
