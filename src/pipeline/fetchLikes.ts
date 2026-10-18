import axios from 'axios';
import { env } from '../config/env';
import { SC_FETCH_DELAY_MS, RAPIDAPI_DATAFANATIC_HOST } from '../config/constants';
import { TrackMetadata } from '../types/track';
import { upsertTracks } from '../db/trackRepository';
import { RateLimiter } from '../utils/rateLimiter';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const SC_PROFILE_URL = `https://soundcloud.com/${env.SOUNDCLOUD_USERNAME}`;
const rateLimiter = new RateLimiter(5, 1);

// DataFanatic API response shape (verified against live API)
interface DFLikesResponse {
  status: boolean;
  errorId: string;
  type: string;
  id: number;
  likes: {
    nextOffsetToken: string | null;
    items: DFLikeItem[];
  };
}

interface DFLikeItem {
  type: string;
  createdAt: string;
  item: {
    type: string;
    id: number;
    permalink: string;
    title: string;
    description: string | null;
    durationMs: number;
    durationText: string;
    artworkUrl: string | null;
    genre: string;
    labelName: string;
    likeCount: number;
    playCount: number;
    repostCount: number;
    commentCount: number;
    waveformUrl: string | null;
    purchaseUrl: string | null;
    tags: string[];
    publisher?: {
      artist: string | null;
    };
    user: {
      type: string;
      id: number;
      permalink: string;
      name: string;
      avatarUrl: string | null;
    };
  };
}

function mapDFTrack(like: DFLikeItem): TrackMetadata {
  const track = like.item;
  return {
    sc_track_id: track.id,
    sc_permalink: track.permalink?.split('soundcloud.com/')[1] || '',
    sc_url: track.permalink || '',
    title: track.title || 'Untitled',
    artist: track.user?.name || track.publisher?.artist || 'Unknown',
    artist_id: track.user?.id || 0,
    description: (track.description || '').substring(0, 5000),
    genre: track.genre || '',
    tags: (track.tags || []).map(t => t.toLowerCase()),
    duration_ms: track.durationMs || 0,
    bpm_stated: null,
    key_stated: null,
    artwork_url: track.artworkUrl || null,
    waveform_url: track.waveformUrl || null,
    stream_url: track.permalink || null, // use permalink for yt-dlp download
    playback_count: track.playCount || 0,
    likes_count: track.likeCount || 0,
    reposts_count: track.repostCount || 0,
    comment_count: track.commentCount || 0,
    liked_at: like.createdAt || null,
  };
}

export async function fetchLikes(): Promise<number> {
  logger.info(`Fetching likes for ${env.SOUNDCLOUD_USERNAME} via DataFanatic API...`);

  let totalFetched = 0;
  let offsetToken: string | null = null;
  let pageNum = 0;
  let consecutiveRateLimits = 0;
  const MAX_CONSECUTIVE_RATE_LIMITS = 5;

  while (true) {
    await rateLimiter.acquire();
    pageNum++;

    try {
      const params: Record<string, string> = {
        user: SC_PROFILE_URL,
      };
      if (offsetToken) {
        params.offsetToken = offsetToken;
      }

      const response = await axios.get<DFLikesResponse>(
        `https://${RAPIDAPI_DATAFANATIC_HOST}/v1/user/likes`,
        {
          params,
          headers: {
            'x-rapidapi-key': env.RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_DATAFANATIC_HOST,
          },
          timeout: 30000,
        }
      );

      consecutiveRateLimits = 0; // reset on success

      const data = response.data;

      if (!data.status || !data.likes?.items?.length) {
        logger.info(`  Page ${pageNum}: no more items`);
        break;
      }

      const items = data.likes.items.filter(i => i.item?.type === 'track');
      const batch = items.map(mapDFTrack);

      if (batch.length > 0) {
        await upsertTracks(batch);
        totalFetched += batch.length;
      }

      logger.info(`  Page ${pageNum}: ${items.length} tracks (total: ${totalFetched})`);

      // Next page
      offsetToken = data.likes.nextOffsetToken || null;
      if (!offsetToken) {
        logger.info('  No more pages');
        break;
      }

      await delay(SC_FETCH_DELAY_MS);
    } catch (err: any) {
      if (err.response?.status === 429) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) {
          logger.warn(`Hit ${MAX_CONSECUTIVE_RATE_LIMITS} consecutive rate limits. Stopping fetch. Got ${totalFetched} tracks. Re-run to continue.`);
          break;
        }
        const waitMs = 15000 * consecutiveRateLimits; // escalating backoff
        logger.warn(`Rate limited (${consecutiveRateLimits}/${MAX_CONSECUTIVE_RATE_LIMITS}), waiting ${waitMs / 1000}s...`);
        await delay(waitMs);
        continue;
      }
      logger.error(`Fetch error on page ${pageNum}: ${err.message}`);
      throw err;
    }
  }

  logger.info(`Fetch complete: ${totalFetched} liked tracks saved to DB`);
  return totalFetched;
}
