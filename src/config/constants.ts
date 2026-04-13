import path from 'path';

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const AUDIO_DIR = path.join(PROJECT_ROOT, 'audio');

// SoundCloud
export const SC_USERNAME = 'soursides';
export const SC_FETCH_LIMIT = 200; // max per API request
export const SC_FETCH_DELAY_MS = 1200; // delay between paginated requests

// Download
export const DOWNLOAD_CONCURRENCY = 10;
export const DOWNLOAD_DELAY_MS = 500;

// Track duration filter (seconds)
// Skip mixes/DJ sets/podcasts — only keep tracks suitable for background music
export const MAX_TRACK_DURATION_SEC = 480; // 8 minutes (generous for intros/outros)
export const MIN_TRACK_DURATION_SEC = 30;  // skip tiny clips/previews

// Analysis
export const ANALYSIS_CONCURRENCY = 2;
export const MEYDA_WINDOW_SIZE = 4096;
export const MEYDA_HOP_SIZE = 2048;
export const SAMPLE_RATE = 44100;

// Embeddings
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 20;

// Search
export const SEARCH_DEFAULT_LIMIT = 10;
export const SEARCH_CANDIDATE_LIMIT = 50;
export const SEMANTIC_WEIGHT = 0.6;
export const FEATURE_WEIGHT = 0.4;

// RapidAPI hosts
export const RAPIDAPI_LUNDEHUND_HOST = 'soundcloud-api4.p.rapidapi.com';
export const RAPIDAPI_DATAFANATIC_HOST = 'soundcloud-scraper.p.rapidapi.com';
