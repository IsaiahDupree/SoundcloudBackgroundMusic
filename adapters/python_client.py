"""
SoundCloud Background Music — Python Client
=============================================
Zero-dependency adapter for accessing the music search API from Python.
Works with music-selector or any Python script.

Usage:
    from python_client import search_music, list_tracks, get_track

    # Natural language search
    results = search_music("chill lofi for coding tutorial")
    best = results[0]
    print(best["title"], best["local_file"])

    # Use with music-selector's suggest.py
    # Set MUSIC_INDEX_PATH to the exported library.json, or use this client
    # to query the live API for dynamic results.

Requires the HTTP API to be running:
    cd C:/Users/Isaia/Documents/Coding/SoundcloudBackgroundMusic
    npm run serve
"""

import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

API_BASE = "http://localhost:3850"


def _get(path: str, params: Optional[Dict] = None) -> Any:
    url = f"{API_BASE}{path}"
    if params:
        qs = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items() if v is not None)
        url += f"?{qs}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _post(path: str, body: Dict) -> Any:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def search_music(
    prompt: str,
    limit: int = 5,
    filters: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    """
    Search for background music by natural language description.

    Args:
        prompt:  e.g. "chill lofi for coding", "heavy dubstep for montage"
        limit:   max results (default 5)
        filters: optional dict with minBpm, maxBpm, minEnergy, maxEnergy, genre

    Returns:
        List of track dicts with: title, artist, genre, bpm, energy,
        duration_sec, sc_url, score, reasons, track_id, local_file
    """
    body: Dict[str, Any] = {"prompt": prompt, "limit": limit}
    if filters:
        body["filters"] = filters
    resp = _post("/api/query", body)
    # Add local_file path for convenience
    for r in resp.get("results", []):
        tid = r.get("track_id")
        if tid:
            r["local_file"] = f"C:/Users/Isaia/Documents/Coding/SoundcloudBackgroundMusic/audio/{tid}.mp3"
    return resp.get("results", [])


def list_tracks(
    page: int = 0,
    limit: int = 50,
    genre: Optional[str] = None,
    artist: Optional[str] = None,
    min_bpm: Optional[float] = None,
    max_bpm: Optional[float] = None,
) -> Dict[str, Any]:
    """List tracks with optional filters. Returns {tracks, total, page, limit}."""
    params = {
        "page": page, "limit": limit,
        "genre": genre, "artist": artist,
        "minBpm": min_bpm, "maxBpm": max_bpm,
    }
    return _get("/api/tracks", {k: v for k, v in params.items() if v is not None})


def get_track(track_id: str) -> Dict[str, Any]:
    """Get full details for a single track."""
    return _get(f"/api/tracks/{track_id}")


def get_stats() -> Dict[str, Any]:
    """Get library stats: total, downloaded, analyzed, embedded counts."""
    return _get("/health")


def pick_best(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Convenience: return the single best track for a prompt, or None.
    Ideal for automated pipelines that just need one track.
    """
    results = search_music(prompt, limit=1)
    return results[0] if results else None


# CLI usage
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python python_client.py 'chill lofi for coding'")
        print("       python python_client.py --stats")
        print("       python python_client.py --list")
        sys.exit(0)

    if sys.argv[1] == "--stats":
        print(json.dumps(get_stats(), indent=2))
    elif sys.argv[1] == "--list":
        data = list_tracks(limit=20)
        print(f"Total: {data['total']} tracks")
        for t in data["tracks"]:
            print(f"  {t.get('genre','?'):<15} BPM:{t.get('bpm_detected','?'):<6} {t['title']} — {t['artist']}")
    else:
        prompt = " ".join(sys.argv[1:])
        results = search_music(prompt, limit=5)
        if not results:
            print("No results found.")
        else:
            for i, r in enumerate(results, 1):
                print(f"\n{i}. [{r['score']:.0%}] {r['title']} — {r['artist']}")
                print(f"   Genre: {r.get('genre','?')} | BPM: {r.get('bpm','?')} | Energy: {r.get('energy','?')}")
                print(f"   {', '.join(r.get('reasons', []))}")
