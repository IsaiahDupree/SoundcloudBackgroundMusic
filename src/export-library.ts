/**
 * Export SoundCloud library to music-selector's library.json format.
 *
 * Bridges the analyzed SoundCloud tracks into the format expected by
 * https://github.com/IsaiahDupree/music-selector
 *
 * Usage:
 *   npx tsc && node build/export-library.js [--out /path/to/library.json] [--limit 200]
 *
 * By default writes to stdout. Use --out to write to a file.
 * Does NOT include secrets — safe to commit the output.
 */

import { getSupabase } from './db/supabaseClient';
import { AUDIO_DIR } from './config/constants';
import { logger } from './utils/logger';
import path from 'path';
import './config/env';

// music-selector mood mapping from audio features
function inferMood(energy: number | null, spectralCentroid: number | null, bpm: number | null): string {
  if (energy == null) return 'calm';
  if (energy > 0.25 && (bpm ?? 0) > 140) return 'energetic';
  if (energy > 0.2 && (bpm ?? 0) > 120) return 'uplifting';
  if (energy > 0.15) return 'inspiring';
  if (energy > 0.08) return 'focused';
  if (energy > 0.04) return 'calm';
  return 'calm';
}

function inferMoods(mood: string, energy: number | null, genre: string): string[] {
  const moods = [mood];
  const g = genre.toLowerCase();

  if (g.includes('dubstep') || g.includes('bass')) moods.push('intense', 'powerful');
  if (g.includes('lofi') || g.includes('lo-fi') || g.includes('chill')) moods.push('chill', 'relaxed');
  if (g.includes('ambient')) moods.push('peaceful', 'relaxed');
  if (g.includes('trap')) moods.push('confident', 'driving');
  if (g.includes('house') || g.includes('techno')) moods.push('groovy', 'hypnotic');
  if (g.includes('dnb') || g.includes('drum')) moods.push('driving', 'intense');

  if ((energy ?? 0) > 0.2) moods.push('energetic');
  if ((energy ?? 0) < 0.06) moods.push('peaceful');

  return [...new Set(moods)];
}

function inferTempo(bpm: number | null): string {
  if (!bpm) return 'medium';
  if (bpm < 90) return 'slow';
  if (bpm < 130) return 'medium';
  if (bpm < 170) return 'fast';
  return 'fast';
}

function inferSuitableFor(energy: number | null, bpm: number | null, genre: string): string[] {
  const suitable: string[] = [];
  const g = genre.toLowerCase();
  const e = energy ?? 0.3;
  const b = bpm ?? 100;

  if (e < 0.1) suitable.push('background', 'tutorial', 'educational');
  if (e < 0.15) suitable.push('dev_vlog');
  if (e >= 0.1 && e < 0.25) suitable.push('storytelling', 'product_demo');
  if (e >= 0.2) suitable.push('montage', 'reels');
  if (e >= 0.3 || b >= 140) suitable.push('viral_short', 'shorts');

  if (g.includes('lofi') || g.includes('ambient')) suitable.push('tutorial', 'background');
  if (g.includes('electronic') || g.includes('house')) suitable.push('dev_vlog', 'reels');
  if (g.includes('cinematic')) suitable.push('storytelling', 'brand');

  return [...new Set(suitable)];
}

function makeSlug(title: string, artist: string): string {
  const raw = `${artist}-${title}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

async function exportLibrary(outPath?: string, limit?: number) {
  const supabase = getSupabase();

  // Only export tracks that are analyzed (have audio features)
  let query = supabase
    .from('sc_tracks')
    .select('*')
    .eq('is_analyzed', true)
    .order('liked_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) {
    logger.warn('No analyzed tracks to export. Run the pipeline first.');
    return;
  }

  const tracks = data.map((t: any) => ({
    id: makeSlug(t.title, t.artist),
    title: t.title,
    artist: t.artist,
    // Point to the local audio file — relative path for portability
    local_path: t.local_filename ? path.join('audio', t.local_filename) : null,
    genre: t.genre || 'unknown',
    subgenres: (t.tags || []).slice(0, 5),
    mood: inferMood(t.energy, t.spectral_centroid, t.bpm_detected),
    moods: inferMoods(
      inferMood(t.energy, t.spectral_centroid, t.bpm_detected),
      t.energy,
      t.genre || ''
    ),
    energy_level: t.energy != null ? Math.round(Math.min(1, t.energy * 4) * 100) / 100 : 0.5,
    tempo: inferTempo(t.bpm_detected),
    bpm: t.bpm_detected ? Math.round(t.bpm_detected) : null,
    duration_sec: t.audio_duration_sec ? Math.round(t.audio_duration_sec) : null,
    source: 'soundcloud',
    license: 'personal_library',
    sc_url: t.sc_url,
    sc_track_id: t.sc_track_id,
    is_trending: (t.playback_count || 0) > 50000,
    platforms_trending: [],
    suitable_for: inferSuitableFor(t.energy, t.bpm_detected, t.genre || ''),
    scene_fit: [],
    usage_count: 0,
  }));

  const library = {
    version: '2.0',
    description: 'Auto-generated from SoundCloud likes — SoundcloudBackgroundMusic pipeline',
    last_updated: new Date().toISOString().split('T')[0],
    tracks_dir: 'audio',
    tracks,
    // Include the standard music-selector maps
    content_type_map: {
      viral_short:  { preferred_genres: ['hip_hop', 'electronic', 'pop', 'house', 'dubstep'], energy_range: [0.7, 1.0], moods: ['energetic', 'uplifting', 'happy'] },
      reels:        { preferred_genres: ['pop', 'hip_hop', 'house', 'electronic'], energy_range: [0.6, 1.0], moods: ['energetic', 'uplifting', 'happy'] },
      tutorial:     { preferred_genres: ['lofi', 'ambient', 'cinematic'], energy_range: [0.2, 0.5], moods: ['calm', 'focused'] },
      educational:  { preferred_genres: ['lofi', 'ambient', 'motivational'], energy_range: [0.3, 0.6], moods: ['calm', 'inspiring', 'focused'] },
      product_demo: { preferred_genres: ['electronic', 'corporate', 'motivational', 'cinematic'], energy_range: [0.5, 0.8], moods: ['uplifting', 'inspiring'] },
      dev_vlog:     { preferred_genres: ['electronic', 'lofi', 'house', 'hip_hop'], energy_range: [0.4, 0.9], moods: ['focused', 'energetic', 'chill'] },
      storytelling: { preferred_genres: ['cinematic', 'ambient', 'motivational'], energy_range: [0.4, 0.8], moods: ['inspiring', 'emotional', 'dramatic'] },
      brand:        { preferred_genres: ['cinematic', 'corporate', 'motivational', 'house'], energy_range: [0.5, 0.8], moods: ['inspiring', 'uplifting'] },
      montage:      { preferred_genres: ['electronic', 'hip_hop', 'house', 'pop', 'dubstep'], energy_range: [0.6, 1.0], moods: ['energetic', 'uplifting'] },
      shorts:       { preferred_genres: ['hip_hop', 'electronic', 'pop', 'dubstep'], energy_range: [0.7, 1.0], moods: ['energetic', 'upbeat'] },
      background:   { preferred_genres: ['ambient', 'lofi', 'cinematic'], energy_range: [0.1, 0.5], moods: ['calm', 'peaceful'] },
    },
    platform_map: {
      instagram: ['reels', 'viral_short', 'lifestyle'],
      tiktok:    ['viral_short', 'shorts', 'montage'],
      youtube:   ['dev_vlog', 'tutorial', 'educational', 'product_demo'],
      linkedin:  ['brand', 'product_demo', 'storytelling'],
      twitter:   ['viral_short', 'reels'],
    },
    mood_compatibility: {
      energetic: ['uplifting', 'upbeat', 'happy', 'powerful', 'confident'],
      calm:      ['relaxed', 'peaceful', 'focused', 'chill', 'neutral'],
      inspiring: ['uplifting', 'hopeful', 'emotional', 'cinematic'],
      dramatic:  ['intense', 'epic', 'powerful', 'cinematic'],
      uplifting: ['happy', 'positive', 'inspiring', 'energetic'],
      happy:     ['upbeat', 'positive', 'bright', 'uplifting'],
      focused:   ['calm', 'chill', 'creative', 'relaxed'],
    },
  };

  const json = JSON.stringify(library, null, 2);

  if (outPath) {
    const fs = require('fs');
    fs.writeFileSync(outPath, json, 'utf-8');
    logger.info(`Exported ${tracks.length} tracks to ${outPath}`);
  } else {
    process.stdout.write(json);
  }
}

// CLI
const outArg = process.argv.find(a => a.startsWith('--out='));
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const outPath = outArg?.split('=')[1];
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

exportLibrary(outPath, limit).catch(err => {
  logger.error(`Export failed: ${err.message}`);
  process.exit(1);
});
