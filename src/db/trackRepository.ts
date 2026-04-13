import { getSupabase } from './supabaseClient';
import { TrackMetadata, AudioFeatures, TrackRow } from '../types/track';
import { SearchFilters } from '../types/query';
import { logger } from '../utils/logger';

const TABLE = 'sc_tracks';

export async function upsertTrack(track: TrackMetadata): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        sc_track_id: track.sc_track_id,
        sc_permalink: track.sc_permalink,
        sc_url: track.sc_url,
        title: track.title,
        artist: track.artist,
        artist_id: track.artist_id,
        description: track.description,
        genre: track.genre,
        tags: track.tags,
        duration_ms: track.duration_ms,
        bpm_stated: track.bpm_stated,
        key_stated: track.key_stated,
        artwork_url: track.artwork_url,
        waveform_url: track.waveform_url,
        stream_url: track.stream_url,
        playback_count: track.playback_count,
        likes_count: track.likes_count,
        reposts_count: track.reposts_count,
        comment_count: track.comment_count,
        liked_at: track.liked_at,
      },
      { onConflict: 'sc_track_id' }
    );

  if (error) {
    logger.error(`Upsert failed for track ${track.sc_track_id}: ${error.message}`);
    throw error;
  }
}

export async function upsertTracks(tracks: TrackMetadata[]): Promise<number> {
  const supabase = getSupabase();
  const rows = tracks.map(t => ({
    sc_track_id: t.sc_track_id,
    sc_permalink: t.sc_permalink,
    sc_url: t.sc_url,
    title: t.title,
    artist: t.artist,
    artist_id: t.artist_id,
    description: t.description,
    genre: t.genre,
    tags: t.tags,
    duration_ms: t.duration_ms,
    bpm_stated: t.bpm_stated,
    key_stated: t.key_stated,
    artwork_url: t.artwork_url,
    waveform_url: t.waveform_url,
    stream_url: t.stream_url,
    playback_count: t.playback_count,
    likes_count: t.likes_count,
    reposts_count: t.reposts_count,
    comment_count: t.comment_count,
    liked_at: t.liked_at,
  }));

  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'sc_track_id' });

  if (error) {
    logger.error(`Batch upsert failed: ${error.message}`);
    throw error;
  }
  return rows.length;
}

export async function getUndownloaded(limit: number = 100): Promise<TrackRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('is_downloaded', false)
    .not('stream_url', 'is', null)
    .is('download_error', null)
    .limit(limit);

  if (error) throw error;
  return (data || []) as TrackRow[];
}

export async function getUnanalyzed(limit: number = 100): Promise<TrackRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('is_analyzed', false)
    .eq('is_downloaded', true)
    .is('analysis_error', null)
    .limit(limit);

  if (error) throw error;
  return (data || []) as TrackRow[];
}

export async function getUnembedded(limit: number = 100): Promise<TrackRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('is_embedded', false)
    .eq('is_analyzed', true)
    .limit(limit);

  if (error) throw error;
  return (data || []) as TrackRow[];
}

export async function markDownloaded(
  id: string,
  filename: string,
  fileSize: number
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .update({
      is_downloaded: true,
      local_filename: filename,
      file_size_bytes: fileSize,
      downloaded_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function markDownloadError(id: string, errorMsg: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .update({ download_error: errorMsg })
    .eq('id', id);

  if (error) throw error;
}

export async function updateAudioFeatures(
  id: string,
  features: AudioFeatures
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .update({
      is_analyzed: true,
      audio_duration_sec: features.audio_duration_sec,
      audio_bitrate: features.audio_bitrate,
      audio_sample_rate: features.audio_sample_rate,
      audio_codec: features.audio_codec,
      bpm_detected: features.bpm_detected,
      energy: features.energy,
      spectral_centroid: features.spectral_centroid,
      spectral_rolloff: features.spectral_rolloff,
      loudness: features.loudness,
      zero_crossing_rate: features.zero_crossing_rate,
      mfcc: features.mfcc,
      analyzed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function markAnalysisError(id: string, errorMsg: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .update({ analysis_error: errorMsg })
    .eq('id', id);

  if (error) throw error;
}

export async function updateEmbedding(
  id: string,
  embedding: number[],
  embeddingText: string
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .update({
      is_embedded: true,
      embedding: JSON.stringify(embedding),
      embedding_text: embeddingText,
      embedded_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function searchByEmbedding(
  queryVec: number[],
  filters: SearchFilters,
  limit: number = 50
): Promise<(TrackRow & { similarity: number })[]> {
  const supabase = getSupabase();

  // Use RPC for pgvector similarity search
  const { data, error } = await supabase.rpc('search_tracks', {
    query_embedding: JSON.stringify(queryVec),
    match_count: limit,
    min_bpm: filters.minBpm || 0,
    max_bpm: filters.maxBpm || 999,
    min_energy: filters.minEnergy || 0,
    max_energy: filters.maxEnergy || 1,
    filter_genre: filters.genre || '',
  });

  if (error) {
    logger.error(`Embedding search failed: ${error.message}`);
    throw error;
  }

  return (data || []) as (TrackRow & { similarity: number })[];
}

export async function getTrackById(id: string): Promise<TrackRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as TrackRow;
}

export async function getTracks(
  page: number = 0,
  limit: number = 50,
  filters?: SearchFilters
): Promise<{ tracks: TrackRow[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  if (filters?.genre) query = query.ilike('genre', `%${filters.genre}%`);
  if (filters?.artist) query = query.ilike('artist', `%${filters.artist}%`);
  if (filters?.minBpm) query = query.gte('bpm_detected', filters.minBpm);
  if (filters?.maxBpm) query = query.lte('bpm_detected', filters.maxBpm);
  if (filters?.minEnergy) query = query.gte('energy', filters.minEnergy);
  if (filters?.maxEnergy) query = query.lte('energy', filters.maxEnergy);

  const { data, error, count } = await query
    .order('liked_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  return { tracks: (data || []) as TrackRow[], total: count || 0 };
}

export async function getStats(): Promise<{
  total: number;
  downloaded: number;
  analyzed: number;
  embedded: number;
}> {
  const supabase = getSupabase();
  const { count: total } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
  const { count: downloaded } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('is_downloaded', true);
  const { count: analyzed } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('is_analyzed', true);
  const { count: embedded } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('is_embedded', true);

  return {
    total: total || 0,
    downloaded: downloaded || 0,
    analyzed: analyzed || 0,
    embedded: embedded || 0,
  };
}
