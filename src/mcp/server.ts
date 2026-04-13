import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchMusic } from '../search/queryEngine';
import { getTrackById, getTracks, getStats } from '../db/trackRepository';
import { getAudioPath, fileExists } from '../utils/fileHelpers';
import '../config/env';

const server = new Server(
  { name: 'soundcloud-music', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_music',
      description:
        'Search background music from a 5000+ track SoundCloud library. ' +
        'Uses AI semantic search + audio feature matching (BPM, energy, genre). ' +
        'Returns ranked tracks with local file paths for immediate use.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description:
              'Natural language description of desired music, e.g. "chill lofi for coding", ' +
              '"upbeat electronic for product demo", "calm ambient for meditation"',
          },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'get_track',
      description: 'Get full details about a specific track by its UUID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          track_id: { type: 'string', description: 'Track UUID from search results' },
        },
        required: ['track_id'],
      },
    },
    {
      name: 'list_tracks',
      description: 'Browse the music library with optional genre/energy/BPM filters.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number, 0-indexed' },
          limit: { type: 'number', description: 'Tracks per page (max 50)' },
          genre: { type: 'string', description: 'Filter by genre (e.g. "dubstep", "lofi")' },
          artist: { type: 'string', description: 'Filter by artist name' },
        },
      },
    },
    {
      name: 'get_music_stats',
      description: 'Get library stats: total tracks, how many downloaded/analyzed/embedded.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'get_track_file',
      description: 'Get the local file path for a track so it can be used in video/audio production.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          track_id: { type: 'string', description: 'Track UUID' },
        },
        required: ['track_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_music': {
        const results = await searchMusic({
          prompt: (args as any).prompt,
          limit: (args as any).limit || 5,
        });
        const output = results.map((r, i) => ({
          rank: i + 1,
          title: r.track.title,
          artist: r.track.artist,
          genre: r.track.genre,
          bpm: r.track.bpm_detected,
          energy: r.track.energy,
          duration_sec: r.track.audio_duration_sec,
          sc_url: r.track.sc_url,
          local_file: r.track.local_filename
            ? `C:/Users/Isaia/Documents/Coding/SoundcloudBackgroundMusic/audio/${r.track.local_filename}`
            : null,
          score: Math.round(r.score * 1000) / 1000,
          reasons: r.reasons,
          track_id: r.track.id,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
      }

      case 'get_track': {
        const track = await getTrackById((args as any).track_id);
        if (!track) return { content: [{ type: 'text', text: 'Track not found' }] };
        return { content: [{ type: 'text', text: JSON.stringify(track, null, 2) }] };
      }

      case 'list_tracks': {
        const { tracks, total } = await getTracks(
          (args as any).page || 0,
          Math.min((args as any).limit || 20, 50),
          { genre: (args as any).genre, artist: (args as any).artist }
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total,
              tracks: tracks.map(t => ({
                id: t.id, title: t.title, artist: t.artist,
                genre: t.genre, bpm: t.bpm_detected, energy: t.energy,
                duration_sec: t.audio_duration_sec,
              })),
            }, null, 2),
          }],
        };
      }

      case 'get_music_stats': {
        const stats = await getStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'get_track_file': {
        const track = await getTrackById((args as any).track_id);
        if (!track) return { content: [{ type: 'text', text: 'Track not found' }] };
        const audioPath = getAudioPath(track.sc_track_id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              path: audioPath,
              exists: fileExists(audioPath),
              title: track.title,
              artist: track.artist,
            }),
          }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
