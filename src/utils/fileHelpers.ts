import fs from 'fs';
import path from 'path';
import { AUDIO_DIR } from '../config/constants';

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function getAudioPath(scTrackId: number | string): string {
  return path.join(AUDIO_DIR, `${scTrackId}.mp3`);
}

export function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}
