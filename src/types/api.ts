// Lundehund SoundCloud API4 response types
export interface SCApiUser {
  id: number;
  username: string;
  permalink: string;
  avatar_url: string;
}

export interface SCApiTrack {
  id: number;
  title: string;
  description: string;
  genre: string;
  tag_list: string;
  duration: number; // milliseconds
  permalink_url: string;
  permalink: string;
  user: SCApiUser;
  artwork_url: string | null;
  waveform_url: string | null;
  stream_url: string | null;
  download_url: string | null;
  playback_count: number;
  favoritings_count: number;
  reposts_count: number;
  comment_count: number;
  bpm: number | null;
  key_signature: string | null;
  streamable: boolean;
  downloadable: boolean;
  created_at: string;
  media?: {
    transcodings?: SCTranscoding[];
  };
}

export interface SCTranscoding {
  url: string;
  preset: string;
  duration: number;
  snipped: boolean;
  format: {
    protocol: string; // 'hls' or 'progressive'
    mime_type: string;
  };
  quality: string;
}

export interface SCApiLikesResponse {
  collection: SCApiLikeItem[];
  next_href: string | null;
}

export interface SCApiLikeItem {
  track: SCApiTrack;
  created_at: string; // when user liked it
}

// DataFanatic fallback types
export interface DFTrackResponse {
  id: number;
  title: string;
  description: string;
  genre: string;
  tag_list: string;
  duration: number;
  permalink_url: string;
  user: { username: string; id: number };
  artwork_url: string | null;
  waveform_url: string | null;
  playback_count: number;
  likes_count: number;
  reposts_count: number;
  comment_count: number;
}
