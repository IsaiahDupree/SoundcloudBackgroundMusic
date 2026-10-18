import { TrackRow } from '../types/track';
import { QueryAnalysis } from '../types/query';
import { SEMANTIC_WEIGHT, FEATURE_WEIGHT } from '../config/constants';

export interface ScoredTrack {
  track: TrackRow;
  score: number;
  semantic_score: number;
  feature_score: number;
  reasons: string[];
}

export function inRange(value: number | null, min: number, max: number): number {
  if (value == null) return 0.5; // neutral if unknown
  if (value >= min && value <= max) return 1.0;
  const distBelow = min - value;
  const distAbove = value - max;
  const dist = Math.max(distBelow, distAbove, 0);
  const range = max - min || 1;
  return Math.max(0, 1 - dist / range);
}

export function scoreResults(
  tracks: (TrackRow & { similarity: number })[],
  analysis: QueryAnalysis
): ScoredTrack[] {
  return tracks.map(track => {
    const reasons: string[] = [];
    const semanticScore = track.similarity || 0;

    // Feature scoring
    let featureScore = 0;
    let featureWeights = 0;

    // BPM match
    if (analysis.bpm_range) {
      const bpmScore = inRange(track.bpm_detected, analysis.bpm_range[0], analysis.bpm_range[1]);
      featureScore += bpmScore * 0.35;
      featureWeights += 0.35;
      if (bpmScore > 0.8 && track.bpm_detected) {
        reasons.push(`BPM ${track.bpm_detected} matches target`);
      }
    }

    // Energy match
    if (analysis.energy_range) {
      const energyScore = inRange(track.energy, analysis.energy_range[0], analysis.energy_range[1]);
      featureScore += energyScore * 0.35;
      featureWeights += 0.35;
      if (energyScore > 0.8) {
        reasons.push(`Energy level matches`);
      }
    }

    // Genre match
    if (analysis.genre_hints.length > 0) {
      const trackGenre = (track.genre || '').toLowerCase();
      const trackTags = (track.tags || []).map(t => t.toLowerCase());
      const genreMatch = analysis.genre_hints.some(
        g => trackGenre.includes(g.toLowerCase()) || trackTags.some(t => t.includes(g.toLowerCase()))
      );
      if (genreMatch) {
        featureScore += 0.3;
        featureWeights += 0.3;
        reasons.push(`Genre/tags match: ${track.genre || track.tags?.join(', ')}`);
      } else {
        featureWeights += 0.3;
      }
    }

    // Normalize feature score
    const normalizedFeature = featureWeights > 0 ? featureScore / featureWeights : 0.5;

    // Combined score
    const finalScore = semanticScore * SEMANTIC_WEIGHT + normalizedFeature * FEATURE_WEIGHT;

    if (semanticScore > 0.7) {
      reasons.unshift(`High semantic match (${(semanticScore * 100).toFixed(0)}%)`);
    }

    return {
      track,
      score: finalScore,
      semantic_score: semanticScore,
      feature_score: normalizedFeature,
      reasons,
    };
  }).sort((a, b) => b.score - a.score);
}
