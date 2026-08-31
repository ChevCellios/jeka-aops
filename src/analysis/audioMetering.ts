import type { AudioAnalysisSummary, NoiseSample, NoiseSource } from './types';

export const AUDIO_ANALYSIS_SAMPLE_RATE = 8_000;
export const AUDIO_ANALYSIS_WINDOW_MS = 250;
const SILENCE_FLOOR_DBFS = -120;

function powerToDbfs(power: number) {
  if (!Number.isFinite(power) || power <= 0) return SILENCE_FLOOR_DBFS;
  return Math.max(SILENCE_FLOOR_DBFS, Math.min(0, 10 * Math.log10(power)));
}

/** Converts decoded floating-point PCM into compact, time-aligned RMS readings. */
export function pcmChannelsToNoiseSamples(
  channels: Float32Array[],
  sampleRate: number,
  windowMs = AUDIO_ANALYSIS_WINDOW_MS,
): NoiseSample[] {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return [];
  const length = Math.min(...channels.map(channel => channel.length));
  const windowSize = Math.max(1, Math.round(sampleRate * windowMs / 1_000));
  const samples: NoiseSample[] = [];

  for (let start = 0; start < length; start += windowSize) {
    const end = Math.min(length, start + windowSize);
    let sumSquares = 0;
    let valueCount = 0;
    for (const channel of channels) {
      for (let index = start; index < end; index += 1) {
        const value = channel[index];
        if (!Number.isFinite(value)) continue;
        const clamped = Math.max(-1, Math.min(1, value));
        sumSquares += clamped * clamped;
        valueCount += 1;
      }
    }
    if (!valueCount) continue;
    samples.push({
      timeMs: Math.round(((start + end) / 2 / sampleRate) * 1_000),
      dbfs: powerToDbfs(sumSquares / valueCount),
    });
  }
  return samples;
}

export function summarizeNoiseSamples(
  samples: NoiseSample[],
  source: NoiseSource,
  sampleRateHz?: number,
): AudioAnalysisSummary | undefined {
  const valid = samples.filter(sample => Number.isFinite(sample.timeMs) && Number.isFinite(sample.dbfs));
  if (!valid.length) return undefined;
  const averagePower = valid.reduce((sum, sample) => sum + 10 ** (sample.dbfs / 10), 0) / valid.length;
  return {
    source,
    sampleCount: valid.length,
    sampleRateHz,
    windowMs: AUDIO_ANALYSIS_WINDOW_MS,
    averageDbfs: powerToDbfs(averagePower),
    peakDbfs: Math.max(...valid.map(sample => Math.min(0, sample.dbfs))),
    note: 'RMS očitanje iz audio zapisa; dBFS nije kalibrirana razina zvučnog tlaka u dB(A).',
  };
}
