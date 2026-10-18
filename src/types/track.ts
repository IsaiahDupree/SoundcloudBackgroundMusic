export interface TrackMetadata {
  sc_track_id: number;
  sc_permalink: string;
  sc_url: string;
  title: string;
  artist: string;
  artist_id: number;
  description: string;
  genre: string;
  tags: string[];
  duration_ms: number;
  bpm_stated: number | null;
  key_stated: string | null;
  artwork_url: string | null;
  waveform_url: string | null;
  stream_url: string | null;
  playback_count: number;
  likes_count: number;
  reposts_count: number;
  comment_count: number;
  liked_at: string | null;
}

export interface AudioFeatures {
  audio_duration_sec: number;
  audio_bitrate: number;
  audio_sample_rate: number;
  audio_codec: string;
  bpm_detected: number | null;
  energy: number;
  spectral_centroid: number;
  spectral_rolloff: number;
  loudness: number;
  zero_crossing_rate: number;
  mfcc: number[];
}

export interface TrackRow extends TrackMetadata {
  id: string;
  is_downloaded: boolean;
  local_filename: string | null;
  file_size_bytes: number | null;
  download_error: string | null;
  downloaded_at: string | null;
  is_analyzed: boolean;
  analyzed_at: string | null;
  analysis_error: string | null;
  is_embedded: boolean;
  embedding_text: string | null;
  embedded_at: string | null;
  created_at: string;
  updated_at: string;
  // Audio features (flattened)
  audio_duration_sec: number | null;
  audio_bitrate: number | null;
  audio_sample_rate: number | null;
  audio_codec: string | null;
  bpm_detected: number | null;
  energy: number | null;
  spectral_centroid: number | null;
  spectral_rolloff: number | null;
  loudness: number | null;
  zero_crossing_rate: number | null;
  mfcc: number[] | null;
}
