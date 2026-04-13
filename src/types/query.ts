import { TrackRow } from './track';

export interface SearchFilters {
  minBpm?: number;
  maxBpm?: number;
  genre?: string;
  minEnergy?: number;
  maxEnergy?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  artist?: string;
}

export interface MusicQuery {
  prompt: string;
  filters?: SearchFilters;
  limit?: number;
}

export interface QueryAnalysis {
  search_text: string;
  mood: string;
  energy_range: [number, number] | null;
  bpm_range: [number, number] | null;
  genre_hints: string[];
  context: string;
}

export interface SearchResult {
  track: TrackRow;
  score: number;
  semantic_score: number;
  feature_score: number;
  reasons: string[];
}
