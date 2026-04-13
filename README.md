# SoundCloud Background Music

AI-powered music library built from your SoundCloud likes. Fetches metadata, downloads audio, extracts audio features, generates semantic embeddings, and provides natural language search for picking background music.

## Stack

- **TypeScript / Node.js** — npm, tsc to `build/`
- **Supabase (local)** — PostgreSQL + pgvector for embeddings
- **RapidAPI** — DataFanatic SoundCloud Scraper for fetching likes
- **yt-dlp** — downloads audio from SoundCloud
- **Meyda** — audio feature extraction (energy, spectral centroid, MFCC, BPM)
- **OpenAI** — `text-embedding-3-small` for semantic search embeddings
- **Express** — HTTP API for querying

## Setup

```bash
# 1. Clone and install
cd C:/Users/Isaia/Documents/Coding/SoundcloudBackgroundMusic
npm install

# 2. Configure .env (copy from .env.example)
cp .env.example .env
# Fill in: RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY

# 3. Ensure local Supabase is running (Docker)
# The schema is deployed to the local Supabase postgres container

# 4. Download yt-dlp.exe to project root
# https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe

# 5. Run the pipeline
npm run pipeline          # Full: fetch → download → analyze → embed
npm run pipeline:fetch    # Just fetch likes metadata from SoundCloud API
npm run pipeline:download # Just download audio via yt-dlp
npm run pipeline:analyze  # Just extract audio features
npm run pipeline:embed    # Just generate OpenAI embeddings
```

## Usage

### CLI Search
```bash
npm run start -- query "chill lofi beats for late night coding"
npm run start -- query "high energy dubstep for workout montage"
```

### HTTP API
```bash
npm run serve   # Starts on http://localhost:3850

# Search by natural language
curl -X POST http://localhost:3850/api/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "chill lofi for coding", "limit": 5}'

# List tracks with filters
curl http://localhost:3850/api/tracks?genre=dubstep&minBpm=140

# Get single track
curl http://localhost:3850/api/tracks/:id

# Stream audio
curl http://localhost:3850/api/tracks/:id/stream --output track.mp3

# Pipeline control
curl -X POST http://localhost:3850/api/pipeline/run -H "Content-Type: application/json" -d '{"stage":"fetch"}'
curl http://localhost:3850/api/pipeline/status

# Health check
curl http://localhost:3850/health
```

## Access from Other Systems

### 1. MCP Server (AI Agents — Claude Code, etc.)

```bash
npm run mcp   # starts MCP server on stdio
```

Tools exposed: `search_music`, `get_track`, `list_tracks`, `get_music_stats`, `get_track_file`

Register in any project's `.mcp.json`:
```json
{
  "mcpServers": {
    "soundcloud-music": {
      "command": "node",
      "args": ["C:\\Users\\Isaia\\Documents\\Coding\\SoundcloudBackgroundMusic\\build\\mcp\\server.js"]
    }
  }
}
```

Or globally in `~/.claude/settings.json` under `"mcpServers"`.

### 2. Python Client (music-selector, scripts)

Zero-dependency client in `adapters/python_client.py`:

```python
import sys
sys.path.insert(0, "C:/Users/Isaia/Documents/Coding/SoundcloudBackgroundMusic/adapters")
from python_client import search_music, pick_best

# Search
results = search_music("chill lofi for coding tutorial", limit=5)
print(results[0]["title"], results[0]["local_file"])

# One-liner for pipelines
track = pick_best("upbeat electronic for product demo")
```

CLI:
```bash
python adapters/python_client.py "chill lofi for coding"
python adapters/python_client.py --stats
python adapters/python_client.py --list
```

Requires `npm run serve` to be running.

### 3. Static Export (music-selector library.json)

```bash
# Export analyzed tracks to music-selector format
npm run export -- --out=C:/path/to/music-selector/library.json

# Or use env var in music-selector
MUSIC_INDEX_PATH=C:/path/to/library.json python suggest.py --mood energetic
```

No server needed — works offline with the exported file.

## Architecture

```
Pipeline:  Fetch Likes → Download Audio → Analyze Features → Generate Embeddings
                ↓              ↓                ↓                    ↓
           RapidAPI        yt-dlp           ffprobe+Meyda       OpenAI API
                ↓              ↓                ↓                    ↓
           sc_tracks      audio/*.mp3      BPM, energy,      vector(1536)
           (metadata)                      spectral, MFCC     in pgvector

Search:  User Prompt → GPT-4o-mini analyzes intent → Embed query →
         pgvector similarity (top 50) → Feature filter + scoring →
         Ranked results (60% semantic + 40% audio features)
```

## Database

Local Supabase PostgreSQL with pgvector extension.

- **`sc_tracks`** — metadata, download state, audio features, embedding vector(1536)
- **`sc_pipeline_runs`** — pipeline stage tracking for resumability
- **`search_tracks()`** — RPC function for pgvector cosine similarity with filters

## Project Structure

```
src/
  index.ts                    # CLI: pipeline | serve | query
  config/env.ts, constants.ts
  types/track.ts, api.ts, query.ts
  db/supabaseClient.ts, schema.sql, searchFunction.sql, trackRepository.ts
  pipeline/orchestrator.ts, fetchLikes.ts, downloadAudio.ts, analyzeAudio.ts, generateEmbeddings.ts
  analysis/ffprobeExtractor.ts, meydaExtractor.ts
  search/queryEngine.ts, promptAnalyzer.ts, scorer.ts
  api/server.ts, routes/{query,tracks,pipeline,health}.ts
  utils/logger.ts, rateLimiter.ts, delay.ts, fileHelpers.ts
audio/           # Downloaded .mp3 files (gitignored)
yt-dlp.exe       # Audio downloader binary (gitignored)
```

## Integration with music-selector

This library serves as a **data source** for [music-selector](https://github.com/IsaiahDupree/music-selector). An export script (`export-library.ts`) generates a `library.json` compatible with music-selector's format, bridging the 5000+ track SoundCloud library into the zero-dependency Python scoring engine.

See `src/export-library.ts` for the bridge, or use the HTTP API directly.

## Secrets

All secrets live in `.env` (gitignored). Never commit:
- `RAPIDAPI_KEY`
- `SUPABASE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

The `.env.example` template contains no secrets.
