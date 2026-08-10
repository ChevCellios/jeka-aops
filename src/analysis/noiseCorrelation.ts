import type { NoiseAssociation, NoiseSample, VehicleTrack } from './types';

/**
 * Correlates recorded dBFS samples with the time interval of a visual track.
 * The confidence remains conservative: it represents correlation, not a
 * calibrated noise measurement or proven source attribution.
 */
export function correlateNoiseToTrack(track: VehicleTrack, samples: NoiseSample[]): NoiseAssociation | undefined {
  const first = track.detections[0];
  const last = track.detections.at(-1);
  if (!first || !last) return undefined;
  const startTimeMs = Math.max(0, first.frameTimeMs - 500);
  const endTimeMs = last.frameTimeMs + 500;
  const matched = samples.filter(sample => sample.timeMs >= startTimeMs && sample.timeMs <= endTimeMs);
  if (!matched.length) return undefined;
  const averageDbfs = matched.reduce((sum, sample) => sum + sample.dbfs, 0) / matched.length;
  const peakDbfs = Math.max(...matched.map(sample => sample.dbfs));
  return {
    startTimeMs,
    endTimeMs,
    averageDbfs,
    peakDbfs,
    confidenceLevel: track.detections.length >= 3 && matched.length >= 3 ? 'likely' : 'unreliable',
    note: 'Vremenska povezanost s tragom vozila; dBFS nije kalibrirana razina zvučnog tlaka.',
  };
}
