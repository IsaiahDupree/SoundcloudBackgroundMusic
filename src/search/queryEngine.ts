import OpenAI from 'openai';
import { env } from '../config/env';
import { EMBEDDING_MODEL, SEARCH_DEFAULT_LIMIT, SEARCH_CANDIDATE_LIMIT } from '../config/constants';
import { MusicQuery, SearchResult, SearchFilters } from '../types/query';
import { searchByEmbedding } from '../db/trackRepository';
import { analyzePrompt } from './promptAnalyzer';
import { scoreResults } from './scorer';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function searchMusic(query: MusicQuery): Promise<SearchResult[]> {
  const limit = query.limit || SEARCH_DEFAULT_LIMIT;

  logger.info(`Searching: "${query.prompt}"`);

  // Step 1: Analyze the prompt to extract structured intent
  const analysis = await analyzePrompt(query.prompt);
  logger.info(`Query analysis: mood=${analysis.mood}, bpm=${JSON.stringify(analysis.bpm_range)}, energy=${JSON.stringify(analysis.energy_range)}`);

  // Step 2: Embed the search text
  const queryVec = await embedQuery(analysis.search_text);

  // Step 3: Merge user-provided filters with AI-extracted ones
  const filters: SearchFilters = {
    minBpm: query.filters?.minBpm ?? (analysis.bpm_range ? analysis.bpm_range[0] * 0.8 : undefined),
    maxBpm: query.filters?.maxBpm ?? (analysis.bpm_range ? analysis.bpm_range[1] * 1.2 : undefined),
    minEnergy: query.filters?.minEnergy ?? (analysis.energy_range ? analysis.energy_range[0] * 0.5 : undefined),
    maxEnergy: query.filters?.maxEnergy ?? (analysis.energy_range ? analysis.energy_range[1] * 1.5 : undefined),
    genre: query.filters?.genre,
    artist: query.filters?.artist,
  };

  // Step 4: Vector similarity search (wide net)
  const candidates = await searchByEmbedding(queryVec, filters, SEARCH_CANDIDATE_LIMIT);
  logger.info(`Found ${candidates.length} candidates from vector search`);

  // Step 5: Score and rank
  const scored = scoreResults(candidates, analysis);

  return scored.slice(0, limit).map(s => ({
    track: s.track,
    score: s.score,
    semantic_score: s.semantic_score,
    feature_score: s.feature_score,
    reasons: s.reasons,
  }));
}
