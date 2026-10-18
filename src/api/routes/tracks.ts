import { Router, Request, Response } from 'express';
import path from 'path';
import { getTracks, getTrackById } from '../../db/trackRepository';
import { AUDIO_DIR } from '../../config/constants';
import { fileExists } from '../../utils/fileHelpers';

export const trackRoutes = Router();

trackRoutes.get('/tracks', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const filters = {
      genre: req.query.genre as string,
      artist: req.query.artist as string,
      minBpm: req.query.minBpm ? parseFloat(req.query.minBpm as string) : undefined,
      maxBpm: req.query.maxBpm ? parseFloat(req.query.maxBpm as string) : undefined,
      minEnergy: req.query.minEnergy ? parseFloat(req.query.minEnergy as string) : undefined,
      maxEnergy: req.query.maxEnergy ? parseFloat(req.query.maxEnergy as string) : undefined,
    };

    const { tracks, total } = await getTracks(page, limit, filters);
    res.json({ tracks, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

trackRoutes.get('/tracks/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const track = await getTrackById(id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

trackRoutes.get('/tracks/:id/stream', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const track = await getTrackById(id);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    if (!track.local_filename) {
      return res.status(404).json({ error: 'Audio not downloaded' });
    }

    const audioPath = path.join(AUDIO_DIR, track.local_filename);
    if (!fileExists(audioPath)) {
      return res.status(404).json({ error: 'Audio file missing' });
    }

    res.setHeader('Content-Type', 'audio/aac');
    res.setHeader('Content-Disposition', `inline; filename="${track.sc_track_id}.aac"`);
    res.sendFile(audioPath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
