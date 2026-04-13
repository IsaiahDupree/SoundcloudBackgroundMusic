-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Main tracks table
CREATE TABLE IF NOT EXISTS sc_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- SoundCloud identity
    sc_track_id BIGINT UNIQUE NOT NULL,
    sc_permalink TEXT,
    sc_url TEXT,

    -- Metadata
    title TEXT NOT NULL,
    artist TEXT,
    artist_id BIGINT,
    description TEXT,
    genre TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    duration_ms BIGINT,
    bpm_stated REAL,
    key_stated TEXT,
    artwork_url TEXT,
    waveform_url TEXT,
    stream_url TEXT,

    -- Counts
    playback_count BIGINT DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    reposts_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,

    -- Download state
    is_downloaded BOOLEAN DEFAULT false,
    local_filename TEXT,
    file_size_bytes BIGINT,
    download_error TEXT,
    downloaded_at TIMESTAMPTZ,

    -- Audio analysis
    is_analyzed BOOLEAN DEFAULT false,
    audio_duration_sec REAL,
    audio_bitrate INTEGER,
    audio_sample_rate INTEGER,
    audio_codec TEXT,
    bpm_detected REAL,
    energy REAL,
    spectral_centroid REAL,
    spectral_rolloff REAL,
    loudness REAL,
    zero_crossing_rate REAL,
    mfcc REAL[],
    analyzed_at TIMESTAMPTZ,
    analysis_error TEXT,

    -- Embedding
    is_embedded BOOLEAN DEFAULT false,
    embedding vector(1536),
    embedding_text TEXT,
    embedded_at TIMESTAMPTZ,

    -- Liked timestamp
    liked_at TIMESTAMPTZ,

    -- Housekeeping
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sc_tracks_sc_track_id ON sc_tracks(sc_track_id);
CREATE INDEX IF NOT EXISTS idx_sc_tracks_not_downloaded ON sc_tracks(is_downloaded) WHERE NOT is_downloaded;
CREATE INDEX IF NOT EXISTS idx_sc_tracks_not_analyzed ON sc_tracks(is_analyzed) WHERE NOT is_analyzed;
CREATE INDEX IF NOT EXISTS idx_sc_tracks_not_embedded ON sc_tracks(is_embedded) WHERE NOT is_embedded;
CREATE INDEX IF NOT EXISTS idx_sc_tracks_genre ON sc_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_sc_tracks_bpm ON sc_tracks(bpm_detected);
CREATE INDEX IF NOT EXISTS idx_sc_tracks_energy ON sc_tracks(energy);

-- HNSW index for vector similarity (better than IVFFlat for <5K rows)
CREATE INDEX IF NOT EXISTS idx_sc_tracks_embedding ON sc_tracks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sc_tracks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sc_tracks_updated_at ON sc_tracks;
CREATE TRIGGER sc_tracks_updated_at
    BEFORE UPDATE ON sc_tracks
    FOR EACH ROW EXECUTE FUNCTION update_sc_tracks_updated_at();

-- Pipeline runs tracking
CREATE TABLE IF NOT EXISTS sc_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    tracks_processed INTEGER DEFAULT 0,
    tracks_total INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);
