import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AUDIO_DIR, DOWNLOAD_CONCURRENCY, DOWNLOAD_DELAY_MS, MAX_TRACK_DURATION_SEC, MIN_TRACK_DURATION_SEC } from '../config/constants';
import { getUndownloaded, markDownloaded, markDownloadError } from '../db/trackRepository';
import { TrackRow } from '../types/track';
import { delay } from '../utils/delay';
import { ensureDir, getAudioPath, getFileSize, fileExists } from '../utils/fileHelpers';
import { logger } from '../utils/logger';

// yt-dlp binary path (in project root)
const YT_DLP = path.join(__dirname, '../../yt-dlp.exe');

function downloadWithYtDlp(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--no-playlist',
      '-x',                       // extract audio
      '--audio-format', 'mp3',    // convert to mp3
      '--audio-quality', '0',     // best quality
      '-o', outputPath,
      '--no-warnings',
      '--quiet',
      url,
    ];

    const proc = spawn(YT_DLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.trim().substring(0, 300)}`));
    });
    proc.on('error', reject);
  });
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function downloadTrack(track: TrackRow): Promise<boolean> {
  const scUrl = track.sc_url || track.stream_url;
  if (!scUrl || !scUrl.includes('soundcloud.com')) {
    await markDownloadError(track.id, 'No valid SoundCloud URL');
    return false;
  }

  // Pre-filter by API duration metadata (duration_ms from SoundCloud)
  if (track.duration_ms) {
    const durationSec = track.duration_ms / 1000;

    if (durationSec > MAX_TRACK_DURATION_SEC) {
      const reason = `SKIP_MIX: ${formatDuration(track.duration_ms)} exceeds ${MAX_TRACK_DURATION_SEC}s limit — likely a mix/DJ set/podcast`;
      logger.info(`  ⏭ Too long (${formatDuration(track.duration_ms)}): ${track.title}`);
      await markDownloadError(track.id, reason);
      return false;
    }

    if (durationSec < MIN_TRACK_DURATION_SEC) {
      const reason = `SKIP_CLIP: ${formatDuration(track.duration_ms)} under ${MIN_TRACK_DURATION_SEC}s — too short (clip/preview)`;
      logger.info(`  ⏭ Too short (${formatDuration(track.duration_ms)}): ${track.title}`);
      await markDownloadError(track.id, reason);
      return false;
    }
  }

  const outputPath = path.join(AUDIO_DIR, `${track.sc_track_id}.mp3`);

  // Skip if already downloaded
  if (fileExists(outputPath) && getFileSize(outputPath) > 0) {
    await markDownloaded(track.id, `${track.sc_track_id}.mp3`, getFileSize(outputPath));
    logger.info(`  ⏭ Already exists: ${track.title}`);
    return true;
  }

  try {
    logger.info(`  ↓ Downloading (${formatDuration(track.duration_ms || 0)}): ${track.title}`);
    await downloadWithYtDlp(scUrl, outputPath);

    const fileSize = getFileSize(outputPath);
    if (fileSize === 0) {
      await markDownloadError(track.id, 'Downloaded file is empty');
      return false;
    }

    // Post-download size check — if file is suspiciously large (>50MB), likely a long mix
    // that had wrong metadata. Delete and mark.
    if (fileSize > 50 * 1024 * 1024) {
      logger.info(`  🗑 Deleting oversized file (${(fileSize / 1024 / 1024).toFixed(0)}MB): ${track.title}`);
      try { fs.unlinkSync(outputPath); } catch {}
      await markDownloadError(track.id, `SKIP_MIX: File too large (${(fileSize / 1024 / 1024).toFixed(0)}MB) — likely a mix/DJ set`);
      return false;
    }

    await markDownloaded(track.id, `${track.sc_track_id}.mp3`, fileSize);
    logger.info(`  ✓ Downloaded (${(fileSize / 1024 / 1024).toFixed(1)}MB): ${track.title}`);
    return true;
  } catch (err: any) {
    logger.error(`  ✗ Failed: ${track.title} — ${err.message}`);
    await markDownloadError(track.id, err.message.substring(0, 500));
    return false;
  }
}

export async function downloadAudio(): Promise<{ downloaded: number; failed: number; skipped: number }> {
  ensureDir(AUDIO_DIR);

  if (!fileExists(YT_DLP)) {
    throw new Error(`yt-dlp not found at ${YT_DLP}. Download it from https://github.com/yt-dlp/yt-dlp/releases`);
  }

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  logger.info('Starting audio download pipeline (yt-dlp)...');
  logger.info(`  Duration filter: ${MIN_TRACK_DURATION_SEC}s – ${MAX_TRACK_DURATION_SEC}s | Max file: 50MB`);

  while (true) {
    const batch = await getUndownloaded(DOWNLOAD_CONCURRENCY);
    if (batch.length === 0) break;

    const results = await Promise.allSettled(
      batch.map(track => downloadTrack(track))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) downloaded++;
      else {
        // Check if it was a skip vs real failure
        failed++;
      }
    }

    logger.info(`Download progress: ${downloaded} done, ${failed} skipped/failed`);
    await delay(DOWNLOAD_DELAY_MS);
  }

  logger.info(`Download complete: ${downloaded} downloaded, ${failed} skipped/failed`);
  return { downloaded, failed, skipped };
}
