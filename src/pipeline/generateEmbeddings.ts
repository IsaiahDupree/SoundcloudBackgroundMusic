import OpenAI from 'openai';
import { env } from '../config/env';
import { EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE } from '../config/constants';
import { getUnembedded, updateEmbedding } from '../db/trackRepository';
import { TrackRow } from '../types/track';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function composeEmbeddingText(track: TrackRow): string {
  const parts: string[] = [];
  parts.push(`Title: ${track.title}`);
  parts.push(`Artist: ${track.artist}`);
  if (track.genre) parts.push(`Genre: ${track.genre}`);
  if (track.tags?.length) parts.push(`Tags: ${track.tags.join(', ')}`);
  if (track.description) parts.push(`Description: ${track.description.substring(0, 400)}`);
  if (track.bpm_detected) parts.push(`BPM: ${track.bpm_detected}`);
  if (track.energy != null) {
    const energyLabel = track.energy < 0.05 ? 'very low' :
      track.energy < 0.1 ? 'low' :
      track.energy < 0.2 ? 'medium' :
      track.energy < 0.35 ? 'high' : 'very high';
    parts.push(`Energy: ${energyLabel}`);
  }
  if (track.audio_duration_sec) {
    const min = Math.floor(track.audio_duration_sec / 60);
    const sec = Math.round(track.audio_duration_sec % 60);
    parts.push(`Duration: ${min}:${sec.toString().padStart(2, '0')}`);
  }
  return parts.join('\n');
}

async function embedBatch(tracks: TrackRow[]): Promise<number> {
  const texts = tracks.map(t => composeEmbeddingText(t));

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    let saved = 0;
    for (let i = 0; i < tracks.length; i++) {
      const embedding = response.data[i]?.embedding;
      if (embedding) {
        await updateEmbedding(tracks[i].id, embedding, texts[i]);
        saved++;
      }
    }
    return saved;
  } catch (err: any) {
    logger.error(`Embedding batch failed: ${err.message}`);
    // Try one at a time
    let saved = 0;
    for (let i = 0; i < tracks.length; i++) {
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: texts[i],
        });
        const embedding = response.data[0]?.embedding;
        if (embedding) {
          await updateEmbedding(tracks[i].id, embedding, texts[i]);
          saved++;
        }
      } catch (innerErr: any) {
        logger.error(`  Embedding failed for "${tracks[i].title}": ${innerErr.message}`);
      }
      await delay(200);
    }
    return saved;
  }
}

export async function generateEmbeddings(): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;

  logger.info('Starting embedding generation pipeline...');

  while (true) {
    const batch = await getUnembedded(EMBEDDING_BATCH_SIZE);
    if (batch.length === 0) break;

    const saved = await embedBatch(batch);
    embedded += saved;
    failed += batch.length - saved;

    logger.info(`Embedding progress: ${embedded} done, ${failed} failed`);
    await delay(500); // respect rate limits
  }

  logger.info(`Embedding complete: ${embedded} embedded, ${failed} failed`);
  return { embedded, failed };
}
