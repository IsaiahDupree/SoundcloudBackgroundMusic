import ffmpeg from 'fluent-ffmpeg';

export interface FFProbeResult {
  duration: number;
  bitrate: number;
  sampleRate: number;
  codec: string;
}

export function ffprobeExtract(filePath: string): Promise<FFProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
      resolve({
        duration: metadata.format?.duration || 0,
        bitrate: parseInt(String(audioStream?.bit_rate || metadata.format?.bit_rate || '0'), 10),
        sampleRate: parseInt(String(audioStream?.sample_rate || '44100'), 10),
        codec: audioStream?.codec_name || 'unknown',
      });
    });
  });
}
