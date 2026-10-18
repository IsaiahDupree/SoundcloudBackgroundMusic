import { spawn } from 'child_process';
import Meyda from 'meyda';
import { MEYDA_WINDOW_SIZE, SAMPLE_RATE } from '../config/constants';
import { logger } from '../utils/logger';

interface MeydaFeatures {
  energy: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  loudness: number;
  mfcc: number[];
  bpmEstimate: number | null;
}

function decodePcmBuffer(filePath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', filePath,
      '-f', 'f32le',      // raw 32-bit float PCM
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',          // mono
      '-v', 'quiet',
      'pipe:1',
    ]);

    ffmpegProcess.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpegProcess.stderr.on('data', () => {}); // suppress
    ffmpegProcess.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode exited with code ${code}`));
      const buffer = Buffer.concat(chunks);
      const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
      resolve(floats);
    });
    ffmpegProcess.on('error', reject);
  });
}

function estimateBpm(onsetStrength: number[], sampleRate: number, hopSize: number): number | null {
  if (onsetStrength.length < 100) return null;

  // Autocorrelation-based BPM detection
  const minLag = Math.floor((60 / 200) * sampleRate / hopSize); // 200 BPM
  const maxLag = Math.floor((60 / 40) * sampleRate / hopSize);  // 40 BPM

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, onsetStrength.length - 1); lag++) {
    let corr = 0;
    const n = Math.min(onsetStrength.length - lag, 1000);
    for (let i = 0; i < n; i++) {
      corr += onsetStrength[i] * onsetStrength[i + lag];
    }
    corr /= n;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const bpm = (60 * sampleRate) / (bestLag * hopSize);
  // Sanity check
  if (bpm < 40 || bpm > 220) return null;
  return Math.round(bpm * 10) / 10;
}

export async function extractMeydaFeatures(filePath: string): Promise<MeydaFeatures> {
  const signal = await decodePcmBuffer(filePath);

  // Process in frames
  const windowSize = MEYDA_WINDOW_SIZE;
  const hopSize = windowSize / 2;
  const numFrames = Math.floor((signal.length - windowSize) / hopSize);

  if (numFrames < 1) {
    return {
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      loudness: -60,
      mfcc: new Array(13).fill(0),
      bpmEstimate: null,
    };
  }

  // Accumulate features
  let totalEnergy = 0;
  let totalCentroid = 0;
  let totalRolloff = 0;
  let totalZcr = 0;
  const mfccAccum = new Array(13).fill(0);
  const spectralFluxValues: number[] = [];
  let prevSpectrum: Float32Array | null = null;
  let validFrames = 0;

  // Process a subset for very long tracks (>5min)
  const maxFrames = Math.min(numFrames, Math.floor(300 * SAMPLE_RATE / hopSize)); // max 5 min
  const step = numFrames > maxFrames ? Math.floor(numFrames / maxFrames) : 1;

  for (let i = 0; i < numFrames && validFrames < maxFrames; i += step) {
    const start = i * hopSize;
    const frame = signal.slice(start, start + windowSize);
    if (frame.length < windowSize) break;

    try {
      const features = Meyda.extract(
        ['rms', 'spectralCentroid', 'spectralRolloff', 'zcr', 'mfcc', 'powerSpectrum'],
        frame
      );

      if (!features) continue;

      const rms = (features as any).rms || 0;
      totalEnergy += rms * rms;
      totalCentroid += (features as any).spectralCentroid || 0;
      totalRolloff += (features as any).spectralRolloff || 0;
      totalZcr += (features as any).zcr || 0;

      const frameMfcc = (features as any).mfcc;
      if (frameMfcc) {
        for (let j = 0; j < Math.min(13, frameMfcc.length); j++) {
          mfccAccum[j] += frameMfcc[j] || 0;
        }
      }

      // Spectral flux for BPM
      const spectrum = (features as any).powerSpectrum;
      if (spectrum && prevSpectrum) {
        let flux = 0;
        for (let j = 0; j < spectrum.length; j++) {
          const diff = (spectrum[j] || 0) - (prevSpectrum[j] || 0);
          if (diff > 0) flux += diff;
        }
        spectralFluxValues.push(flux);
      }
      prevSpectrum = spectrum ? new Float32Array(spectrum) : null;

      validFrames++;
    } catch {
      continue;
    }
  }

  if (validFrames === 0) {
    return {
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      loudness: -60,
      mfcc: new Array(13).fill(0),
      bpmEstimate: null,
    };
  }

  const avgEnergy = Math.sqrt(totalEnergy / validFrames);
  const loudnessDb = avgEnergy > 0 ? 20 * Math.log10(avgEnergy) : -60;

  return {
    energy: avgEnergy,
    spectralCentroid: totalCentroid / validFrames,
    spectralRolloff: totalRolloff / validFrames,
    zeroCrossingRate: totalZcr / validFrames,
    loudness: loudnessDb,
    mfcc: mfccAccum.map(v => v / validFrames),
    bpmEstimate: estimateBpm(spectralFluxValues, SAMPLE_RATE, hopSize),
  };
}
