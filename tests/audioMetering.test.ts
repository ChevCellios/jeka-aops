import { describe, expect, it } from 'vitest';
import { pcmChannelsToNoiseSamples, summarizeNoiseSamples } from '../src/analysis/audioMetering';

describe('audio metering', () => {
  it('converts full-scale PCM to 0 dBFS in time-aligned windows', () => {
    const samples = pcmChannelsToNoiseSamples([new Float32Array(8).fill(1)], 8, 500);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ timeMs: 250, dbfs: 0 });
    expect(samples[1].timeMs).toBe(750);
  });

  it('calculates RMS across channels and uses a safe silence floor', () => {
    const halfScale = pcmChannelsToNoiseSamples([new Float32Array(4).fill(0.5), new Float32Array(4).fill(-0.5)], 4, 1_000);
    expect(halfScale[0].dbfs).toBeCloseTo(-6.0206, 3);
    expect(pcmChannelsToNoiseSamples([new Float32Array(4)], 4, 1_000)[0].dbfs).toBe(-120);
  });

  it('summarizes readings by acoustic power rather than averaging decibels', () => {
    const summary = summarizeNoiseSamples([{ timeMs: 125, dbfs: 0 }, { timeMs: 375, dbfs: -120 }], 'embedded-video', 8_000);
    expect(summary?.averageDbfs).toBeCloseTo(-3.0103, 3);
    expect(summary?.peakDbfs).toBe(0);
    expect(summary?.sampleCount).toBe(2);
  });
});
