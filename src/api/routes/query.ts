import { Router, Request, Response } from 'express';
import { searchMusic } from '../../search/queryEngine';

export const queryRoutes = Router();

queryRoutes.post('/query', async (req: Request, res: Response) => {
  try {
    const { prompt, filters, limit } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const results = await searchMusic({ prompt, filters, limit });
    res.json({
      query: prompt,
      count: results.length,
      results: results.map(r => ({
        title: r.track.title,
        artist: r.track.artist,
        genre: r.track.genre,
        bpm: r.track.bpm_detected,
        energy: r.track.energy,
        duration_sec: r.track.audio_duration_sec,
        sc_url: r.track.sc_url,
        score: Math.round(r.score * 1000) / 1000,
        semantic_score: Math.round(r.semantic_score * 1000) / 1000,
        feature_score: Math.round(r.feature_score * 1000) / 1000,
        reasons: r.reasons,
        track_id: r.track.id,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
