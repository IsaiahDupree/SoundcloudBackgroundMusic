-- Supabase RPC function for pgvector similarity search with filters
-- Run this in the Supabase SQL editor after the main schema

CREATE OR REPLACE FUNCTION search_tracks(
    query_embedding TEXT,
    match_count INT DEFAULT 50,
    min_bpm FLOAT DEFAULT 0,
    max_bpm FLOAT DEFAULT 999,
    min_energy FLOAT DEFAULT 0,
    max_energy FLOAT DEFAULT 1,
    filter_genre TEXT DEFAULT ''
)
RETURNS TABLE (
    id UUID,
    sc_track_id BIGINT,
    sc_permalink TEXT,
    sc_url TEXT,
    title TEXT,
    artist TEXT,
    artist_id BIGINT,
    description TEXT,
    genre TEXT,
    tags TEXT[],
    duration_ms BIGINT,
    bpm_stated REAL,
    key_stated TEXT,
    artwork_url TEXT,
    waveform_url TEXT,
    stream_url TEXT,
    playback_count BIGINT,
    likes_count BIGINT,
    reposts_count BIGINT,
    comment_count BIGINT,
    is_downloaded BOOLEAN,
    local_filename TEXT,
    file_size_bytes BIGINT,
    download_error TEXT,
    downloaded_at TIMESTAMPTZ,
    is_analyzed BOOLEAN,
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
    is_embedded BOOLEAN,
    embedding_text TEXT,
    embedded_at TIMESTAMPTZ,
    liked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.sc_track_id,
        t.sc_permalink,
        t.sc_url,
        t.title,
        t.artist,
        t.artist_id,
        t.description,
        t.genre,
        t.tags,
        t.duration_ms,
        t.bpm_stated,
        t.key_stated,
        t.artwork_url,
        t.waveform_url,
        t.stream_url,
        t.playback_count,
        t.likes_count,
        t.reposts_count,
        t.comment_count,
        t.is_downloaded,
        t.local_filename,
        t.file_size_bytes,
        t.download_error,
        t.downloaded_at,
        t.is_analyzed,
        t.audio_duration_sec,
        t.audio_bitrate,
        t.audio_sample_rate,
        t.audio_codec,
        t.bpm_detected,
        t.energy,
        t.spectral_centroid,
        t.spectral_rolloff,
        t.loudness,
        t.zero_crossing_rate,
        t.mfcc,
        t.analyzed_at,
        t.analysis_error,
        t.is_embedded,
        t.embedding_text,
        t.embedded_at,
        t.liked_at,
        t.created_at,
        t.updated_at,
        1 - (t.embedding <=> query_embedding::vector) AS similarity
    FROM sc_tracks t
    WHERE t.is_embedded = true
        AND (min_bpm = 0 OR t.bpm_detected IS NULL OR t.bpm_detected >= min_bpm)
        AND (max_bpm = 999 OR t.bpm_detected IS NULL OR t.bpm_detected <= max_bpm)
        AND (min_energy = 0 OR t.energy IS NULL OR t.energy >= min_energy)
        AND (max_energy = 1 OR t.energy IS NULL OR t.energy <= max_energy)
        AND (filter_genre = '' OR t.genre ILIKE '%' || filter_genre || '%')
    ORDER BY t.embedding <=> query_embedding::vector
    LIMIT match_count;
END;
$$;
