import { describe, expect, it } from 'vitest';
import { correlateNoiseToTrack } from '../src/analysis/noiseCorrelation';
import type { VehicleTrack } from '../src/analysis/types';

const track: VehicleTrack = {
  id: 'track-1',
  detections: [500, 1_000, 1_500].map(frameTimeMs => ({
    label: 'vehicle' as const,
    confidence: 0.8,
    frameTimeMs,
    boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  })),
  evidenceFrameIds: [],
  plateCandidates: [],
  identityCandidates: [],
};

describe('correlateNoiseToTrack', () => {
  it('koristi prozor od 500 ms oko vizualnog traga', () => {
    const result = correlateNoiseToTrack(track, [
      { timeMs: 0, dbfs: -40 },
      { timeMs: 500, dbfs: -20 },
      { timeMs: 1_000, dbfs: -10 },
      { timeMs: 2_000, dbfs: -30 },
      { timeMs: 2_001, dbfs: -5 },
    ]);
    expect(result).toMatchObject({ startTimeMs: 0, endTimeMs: 2_000, peakDbfs: -10, confidenceLevel: 'likely' });
    expect(result?.averageDbfs).toBe(-25);
  });

  it('ne stvara povezanost kada nema audio uzoraka u prozoru', () => {
    expect(correlateNoiseToTrack(track, [{ timeMs: 3_000, dbfs: -10 }])).toBeUndefined();
  });
});
